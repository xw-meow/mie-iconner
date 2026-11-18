import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderPlus, ImagePlus, Plus } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { DialogShell } from '@/components/ui/Dialog'
import { FolderMark } from '@/components/ui/FolderGlyph'
import { Spinner } from '@/components/ui/Keycap'
import { useLibraryQuery } from '@/features/queries'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { errorText, importFailureLabel } from '@/lib/errors'
import { pickImages } from '@/lib/system'
import { notifyError, notifySuccess } from '@/lib/toast'
import { useImportStore } from '@/stores/import'
import { useSelectionStore } from '@/stores/selection'
import { useUIStore } from '@/stores/ui'

const NEW_CATEGORY = '\u0001new'
const INVALID_NAME = /[/\\:]/

export function ImportDialog() {
  const open = useImportStore((state) => state.open)
  const presetFiles = useImportStore((state) => state.files)
  const presetCategory = useImportStore((state) => state.category)
  const close = useImportStore((state) => state.close)
  const queryClient = useQueryClient()
  const { data: library } = useLibraryQuery()
  const categories = useMemo(() => library?.custom ?? [], [library])

  const [selected, setSelected] = useState<string>(NEW_CATEGORY)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    const exists =
      presetCategory !== null &&
      categories.some((category) => category.name === presetCategory)
    if (exists && presetCategory) {
      setSelected(presetCategory)
      setNewName('')
    } else if (presetCategory) {
      setSelected(NEW_CATEGORY)
      setNewName(presetCategory)
    } else if (categories.length > 0) {
      setSelected(categories[0].name)
      setNewName('')
    } else {
      setSelected(NEW_CATEGORY)
      setNewName('')
    }
    // 仅在弹出时做一次初始化；dialog 内切换分类不应被外部数据覆盖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const isNew = selected === NEW_CATEGORY
  const trimmedName = newName.trim()
  const targetCategory = isNew ? trimmedName : selected
  const nameValid =
    targetCategory.length > 0 &&
    targetCategory.length <= 80 &&
    !INVALID_NAME.test(targetCategory) &&
    !targetCategory.startsWith('.') &&
    targetCategory !== '..'

  const importMutation = useMutation({
    mutationFn: ({ paths, category }: { paths: string[]; category: string }) =>
      api.importIcons(paths, category),
    onSuccess: (report, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['library'] })
      useUIStore.getState().setTab('custom')
      if (report.imported[0]) {
        useSelectionStore.getState().selectIcon(report.imported[0])
      }
      if (report.failed.length > 0) {
        notifyError(
          `已导入 ${report.imported.length} 张，${report.failed.length} 张失败`,
          importFailureLabel(report.failed[0].reason),
        )
      } else if (report.imported.length > 0) {
        notifySuccess(
          `已导入 ${report.imported.length} 张贴纸`,
          `存到了「${variables.category}」`,
        )
      }
      close()
    },
    onError: (mutationError) => {
      setError(errorText(mutationError))
      notifyError('导入失败', errorText(mutationError))
    },
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createCategory(name),
    onSuccess: (name) => {
      void queryClient.invalidateQueries({ queryKey: ['library'] })
      useUIStore.getState().setTab('custom')
      notifySuccess(`已创建分类「${name}」`, '现在可以把图片拖进来了')
      close()
    },
    onError: (mutationError) => {
      setError(errorText(mutationError))
    },
  })

  const busy = importMutation.isPending || createMutation.isPending

  const validate = (): boolean => {
    if (!targetCategory) {
      setError('先给分类起个名字')
      return false
    }
    if (!nameValid) {
      setError('分类名不能包含 / \\ : 等字符')
      return false
    }
    return true
  }

  const handlePrimary = async () => {
    if (!validate()) return
    let paths = presetFiles
    if (paths.length === 0) {
      paths = await pickImages()
      if (paths.length === 0) return
    }
    importMutation.mutate({ paths, category: targetCategory })
  }

  const handleCreateOnly = () => {
    if (!validate()) return
    createMutation.mutate(targetCategory)
  }

  return (
    <DialogShell
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) close()
      }}
      icon={<ImagePlus className="size-4" />}
      title="导入贴纸"
      description="图片会复制进「我的贴纸」，原文件不会被动到。"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={close}
            disabled={busy}
          >
            取消
          </Button>
          {isNew && presetFiles.length === 0 ? (
            <Button
              variant="ghost"
              onClick={handleCreateOnly}
              disabled={busy || !nameValid}
            >
              {createMutation.isPending ? <Spinner /> : null}
              只创建分类
            </Button>
          ) : null}
          <Button
            variant="primary"
            onClick={() => void handlePrimary()}
            disabled={busy || !nameValid}
          >
            {importMutation.isPending ? (
              <Spinner />
            ) : presetFiles.length > 0 ? (
              <ImagePlus className="size-3.5" />
            ) : (
              <Plus className="size-3.5" />
            )}
            {importMutation.isPending
              ? '导入中…'
              : presetFiles.length > 0
                ? `导入 ${presetFiles.length} 张`
                : '选择图片…'}
          </Button>
        </>
      }
    >
      {presetFiles.length > 0 ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-line/80 bg-[#fcf8f1] px-3 py-2.5">
          <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
            <ImagePlus className="size-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11.5px] font-medium text-ink">
              已选择 {presetFiles.length} 张图片
            </p>
            <p className="mt-0.5 truncate text-[10.5px] text-ink-3">
              {presetFiles
                .slice(0, 3)
                .map((file) => file.split('/').at(-1))
                .join('、')}
              {presetFiles.length > 3 ? ` 等 ${presetFiles.length} 张` : ''}
            </p>
          </div>
        </div>
      ) : null}

      <p className="mb-2 text-[11px] font-medium text-ink-2">存到哪个分类</p>
      <div className="scroll-area flex max-h-[146px] flex-wrap gap-1.5 overflow-y-auto pb-1">
        {categories.map((category) => {
          const active = selected === category.name
          return (
            <button
              key={category.name}
              type="button"
              onClick={() => {
                setSelected(category.name)
                setNewName('')
                setError(null)
              }}
              className={cn(
                'flex h-7 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] transition-colors',
                active
                  ? 'border-brand/60 bg-brand-tint text-brand'
                  : 'border-line bg-white text-ink-2 hover:border-line-strong hover:bg-hover',
              )}
            >
              <FolderMark className="size-3.5 shrink-0" />
              <span className="max-w-[150px] truncate">{category.name}</span>
              <span
                className={cn(
                  'text-[10px] tabular-nums',
                  active ? 'text-brand/70' : 'text-ink-3',
                )}
              >
                {category.icons.length}
              </span>
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => {
            setSelected(NEW_CATEGORY)
            setError(null)
          }}
          className={cn(
            'flex h-7 items-center gap-1 rounded-full border border-dashed px-2.5 text-[11.5px] transition-colors',
            isNew
              ? 'border-brand/60 bg-brand-tint text-brand'
              : 'border-line-strong/80 text-ink-3 hover:border-brand/40 hover:text-brand',
          )}
        >
          <FolderPlus className="size-3.5" />
          新建分类
        </button>
      </div>

      {isNew ? (
        <div className="mt-3">
          <input
            value={newName}
            onChange={(event) => {
              setNewName(event.target.value)
              setError(null)
            }}
            autoFocus
            maxLength={80}
            placeholder="分类名称，比如「旅行」"
            className="h-9 w-full rounded-xl border border-line bg-white px-3 text-[12.5px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-brand/55 focus:ring-2 focus:ring-brand/10"
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handlePrimary()
            }}
          />
        </div>
      ) : null}

      {error ? (
        <p className="mt-2.5 text-[11px] text-danger">{error}</p>
      ) : null}
    </DialogShell>
  )
}
