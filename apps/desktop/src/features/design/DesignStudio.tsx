import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Palette,
  Redo2,
  Sparkles,
  Undo2,
} from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { IconButton } from '@/components/ui/IconButton'
import { Spinner } from '@/components/ui/Keycap'
import { DesignCanvas } from '@/features/design/DesignCanvas'
import { InspectorPanel } from '@/features/design/InspectorPanel'
import { StickerDrawer } from '@/features/design/StickerDrawer'
import {
  CANVAS_SIZE,
  DEFAULT_BACKGROUND,
  createEmptyDocument,
  createLayer,
  duplicateLayer,
  isEditableTarget,
  shiftLayer,
  updateEffects,
  updateLayer,
  type DesignDocument,
  type DesignLayer,
  type LayerEffects,
} from '@/features/design/model'
import { renderDesign } from '@/features/design/renderDesign'
import { useDesignHistory } from '@/features/design/useDesignHistory'
import { api } from '@/lib/api'
import { errorText } from '@/lib/errors'
import { notifyError, notifySuccess } from '@/lib/toast'
import { useDesignStore } from '@/stores/design'
import { useSelectionStore } from '@/stores/selection'
import type { FolderItem, IconItem } from '@/types/api'

interface DesignStudioProps {
  folder: FolderItem
}

const makeId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `layer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

/**
 * 全屏设计工作台：素材抽屉 + 1024 画布 + 图层/滤镜面板。
 * 离开本视图后设计稿不会持久化，应用设计会把画布渲染成 PNG 写进文件夹。
 */
export function DesignStudio({ folder }: DesignStudioProps) {
  const queryClient = useQueryClient()
  const closeDesign = useDesignStore((state) => state.closeDesign)
  const markApplied = useSelectionStore((state) => state.markApplied)
  const { doc, update, undo, redo, canUndo, canRedo } =
    useDesignHistory<DesignDocument>(createEmptyDocument())
  const [stickerAdding, setStickerAdding] = useState(false)
  const addingRef = useRef(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)

  const applyDesign = useMutation({
    mutationFn: async (document: DesignDocument) => {
      const png = await renderDesign(document)
      await api.applyDesign(png, folder.path)
    },
    onSuccess: () => {
      notifySuccess(
        `已给「${folder.name}」贴上新图标`,
        '这是刚在画布上设计的样子',
      )
      markApplied(folder.path)
      window.setTimeout(() => {
        useSelectionStore.getState().clearApplied()
      }, 1000)
      void queryClient.invalidateQueries({ queryKey: ['folders'] })
      closeDesign()
    },
    onError: (error) => {
      notifyError(`没能给「${folder.name}」应用设计`, errorText(error))
    },
  })

  const requestClose = useCallback(() => {
    if (applyDesign.isPending) return
    const hasWork =
      doc.layers.length > 0 || doc.background !== DEFAULT_BACKGROUND
    if (hasWork) {
      setLeaveOpen(true)
      return
    }
    closeDesign()
  }, [applyDesign.isPending, closeDesign, doc.background, doc.layers.length])

  const activeSelectedId =
    selectedId && doc.layers.some((layer) => layer.id === selectedId)
      ? selectedId
      : null

  const addSticker = useCallback(
    async (icon: IconItem, position?: { x: number; y: number }) => {
      if (addingRef.current) return
      addingRef.current = true
      setStickerAdding(true)
      try {
        const src = await queryClient.fetchQuery({
          queryKey: ['design-asset', icon.path, icon.modified],
          queryFn: () => api.designAsset(icon.path),
          staleTime: Infinity,
        })
        const id = makeId()
        update((current) => {
          const offset = (current.layers.length % 4) * 18
          const layer = createLayer(icon, src, id, position ?? {
            x: CANVAS_SIZE / 2 + offset - 27,
            y: CANVAS_SIZE / 2 + offset - 27,
          })
          return { ...current, layers: [...current.layers, layer] }
        })
        setSelectedId(id)
      } catch (error) {
        notifyError('没能加入贴纸', errorText(error))
      } finally {
        addingRef.current = false
        setStickerAdding(false)
      }
    },
    [queryClient, update],
  )

  const changeLayer = useCallback(
    (id: string, patch: Partial<DesignLayer>, key?: string) => {
      update((current) => updateLayer(current, id, patch), key)
    },
    [update],
  )

  const changeEffects = useCallback(
    (id: string, patch: Partial<LayerEffects>, key?: string) => {
      update((current) => updateEffects(current, id, patch), key)
    },
    [update],
  )

  const handleShiftLayer = useCallback(
    (id: string, direction: 1 | -1) => {
      update((current) => shiftLayer(current, id, direction))
    },
    [update],
  )

  const handleDuplicate = useCallback(
    (id: string) => {
      const nextId = makeId()
      update((current) => duplicateLayer(current, id, nextId))
      setSelectedId(nextId)
    },
    [update],
  )

  const handleDelete = useCallback(
    (id: string) => {
      update((current) => ({
        ...current,
        layers: current.layers.filter((layer) => layer.id !== id),
      }))
    },
    [update],
  )

  const handleBackground = useCallback(
    (color: string) => {
      update((current) => ({ ...current, background: color }), 'background')
    },
    [update],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (leaveOpen || isEditableTarget(event.target)) return
      const command = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()

      if (command && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (command && key === 'y') {
        event.preventDefault()
        redo()
        return
      }
      if (key === 'escape') {
        event.preventDefault()
        if (activeSelectedId) setSelectedId(null)
        else requestClose()
        return
      }
      if ((key === 'backspace' || key === 'delete') && activeSelectedId) {
        event.preventDefault()
        handleDelete(activeSelectedId)
        return
      }
      if (command && key === 'd' && activeSelectedId) {
        event.preventDefault()
        handleDuplicate(activeSelectedId)
        return
      }
      if (activeSelectedId && event.key.startsWith('Arrow')) {
        event.preventDefault()
        const step = event.shiftKey ? 32 : 8
        update((current) => {
          const layer = current.layers.find((item) => item.id === activeSelectedId)
          if (!layer) return current
          const patch = {
            x:
              event.key === 'ArrowLeft'
                ? Math.max(0, layer.x - step)
                : event.key === 'ArrowRight'
                  ? Math.min(CANVAS_SIZE, layer.x + step)
                  : layer.x,
            y:
              event.key === 'ArrowUp'
                ? Math.max(0, layer.y - step)
                : event.key === 'ArrowDown'
                  ? Math.min(CANVAS_SIZE, layer.y + step)
                  : layer.y,
          }
          return updateLayer(current, activeSelectedId, patch)
        }, `nudge-${activeSelectedId}`)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    handleDelete,
    handleDuplicate,
    leaveOpen,
    redo,
    requestClose,
    activeSelectedId,
    undo,
    update,
  ])

  const applying = applyDesign.isPending
  const busy = applying || stickerAdding

  return (
    <div className="app-canvas flex h-full min-h-0 flex-col overflow-hidden">
      <header
        data-tauri-drag-region="deep"
        className="relative z-30 flex h-14 shrink-0 select-none items-center gap-2.5 border-b border-line bg-[#fdfaf4] pl-[84px] pr-3"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-brand text-white shadow-[0_5px_12px_-7px_rgb(232_74_31_/_0.8)]">
          <Palette className="size-4" strokeWidth={1.9} />
        </div>
        <div className="min-w-0">
          <h1 className="font-rounded text-[14px] font-bold leading-5 text-ink">
            自定义设计
          </h1>
          <p
            className="max-w-[260px] truncate text-[10.5px] leading-4 text-ink-3"
            title={folder.path}
          >
            为「{folder.name}」设计图标
          </p>
        </div>

        <span className="mx-1 h-5 w-px shrink-0 bg-line" />

        <IconButton
          label="撤销 ⌘Z"
          variant="ghost"
          disabled={!canUndo || busy}
          onClick={undo}
        >
          <Undo2 className="size-4" strokeWidth={1.9} />
        </IconButton>
        <IconButton
          label="重做 ⇧⌘Z"
          variant="ghost"
          disabled={!canRedo || busy}
          onClick={redo}
        >
          <Redo2 className="size-4" strokeWidth={1.9} />
        </IconButton>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            disabled={busy}
            onClick={requestClose}
          >
            <ArrowLeft className="size-3.5" strokeWidth={2.1} />
            返回
          </Button>
          <Button
            variant="primary"
            size="md"
            className="min-w-[108px]"
            disabled={busy}
            onClick={() => applyDesign.mutate(doc)}
          >
            {applying ? (
              <Spinner />
            ) : (
              <Sparkles className="size-3.5" strokeWidth={2.1} />
            )}
            {applying ? '正在应用…' : '应用设计'}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <StickerDrawer
          busy={busy}
          onAdd={(icon) => void addSticker(icon)}
        />
        <DesignCanvas
          doc={doc}
          selectedId={activeSelectedId}
          onSelect={setSelectedId}
          onLayerChange={changeLayer}
          onDropSticker={(icon, position) => void addSticker(icon, position)}
        />
        <InspectorPanel
          doc={doc}
          selectedId={activeSelectedId}
          onSelect={setSelectedId}
          onBackground={handleBackground}
          onLayerChange={changeLayer}
          onEffectsChange={changeEffects}
          onShiftLayer={handleShiftLayer}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      </div>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="返回贴纸册？"
        description={
          doc.layers.length > 0
            ? `画布上的 ${doc.layers.length} 个图层还没有应用，返回后会丢失。`
            : '画布背景的修改还没有应用，返回后会丢失。'
        }
        confirmLabel="放弃并返回"
        destructive
        onConfirm={() => {
          setLeaveOpen(false)
          closeDesign()
        }}
      />
    </div>
  )
}
