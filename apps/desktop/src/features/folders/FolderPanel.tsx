import { useCallback, useEffect, useRef } from 'react'
import { FolderSearch, FolderX, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useApplyActions } from '@/features/apply/useApplyActions'
import { FolderCard } from '@/features/folders/FolderCard'
import { useEnvQuery, useFoldersQuery } from '@/features/queries'
import { api } from '@/lib/api'
import { errorText } from '@/lib/errors'
import { notifyError } from '@/lib/toast'
import { pickFolder } from '@/lib/system'
import { parentPath, useBrowserStore } from '@/stores/browser'
import { useSelectionStore } from '@/stores/selection'
import type { FolderItem } from '@/types/api'

interface FolderPanelProps {
  actions: ReturnType<typeof useApplyActions>
}

export function FolderPanel({ actions }: FolderPanelProps) {
  const path = useBrowserStore((state) => state.path)
  const setPath = useBrowserStore((state) => state.setPath)
  const { data: env } = useEnvQuery()
  const { data: folders, isLoading, error, refetch } = useFoldersQuery(path)
  const clearSelection = useSelectionStore((state) => state.clear)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [path])

  // 应用/还原后目录里的 Icon\r 变了：用最新列表同步选中项，
  // 这样底部组合台的图标与「已有自定义图标」文案也会即时更新
  useEffect(() => {
    if (!folders) return
    const selection = useSelectionStore.getState().folder
    if (!selection) return
    const fresh = folders.find((folder) => folder.path === selection.path)
    if (!fresh) {
      useSelectionStore.getState().selectFolder(null)
    } else if (
      fresh.hasCustomIcon !== selection.hasCustomIcon ||
      fresh.iconModified !== selection.iconModified
    ) {
      useSelectionStore.getState().selectFolder(fresh)
    }
  }, [folders])

  const handleBlankMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement
      if (target.closest('[data-folder-card],button,a,input')) return
      clearSelection()
    },
    [clearSelection],
  )

  const handleOpen = useCallback(
    (folder: FolderItem) => {
      setPath(folder.path)
    },
    [setPath],
  )

  const handlePickFolder = async () => {
    const selected = await pickFolder()
    if (!selected) return
    const resolved = await api.resolvePath(selected)
    if (!resolved) {
      notifyError('无法打开这个文件夹', selected)
      return
    }
    setPath(resolved.path)
  }

  const goDesktop = async () => {
    const target = env?.desktop ?? env?.home
    if (!target) return
    const resolved = await api.resolvePath(target)
    if (resolved) setPath(resolved.path)
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface-raised pb-4">
      <div
        ref={scrollRef}
        onMouseDown={handleBlankMouseDown}
        className="scroll-area dot-grid relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {isLoading ? (
          <FolderSkeleton />
        ) : error ? (
          <div className="flex h-full items-center justify-center pb-10">
            <EmptyState
              icon={<FolderX className="size-5" />}
              title="打不开这个文件夹"
              description={errorText(error)}
              action={
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => void refetch()}>
                    重试
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void goDesktop()}>
                    回到桌面
                  </Button>
                </div>
              }
            />
          </div>
        ) : !folders || folders.length === 0 ? (
          <div className="flex h-full items-center justify-center pb-10">
            <EmptyState
              icon={<FolderSearch className="size-5" />}
              title="这个文件夹里没有子文件夹"
              description="可以回到上一级，或者挑个文件夹的上一级重新开始。"
              action={
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setPath(parentPath(path))}
                  >
                    <Undo2 className="size-3.5" />
                    返回上一级
                  </Button>
                  <Button size="sm" onClick={() => void handlePickFolder()}>
                    选择文件夹
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] content-start gap-1 p-4">
            {folders.map((folder) => (
              <FolderCard
                key={folder.path}
                folder={folder}
                actions={actions}
                onOpen={handleOpen}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function FolderSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1 p-4">
      {Array.from({ length: 12 }).map((_, index) => (
        <div
          key={index}
          className="flex h-[104px] flex-col items-center justify-center gap-2 rounded-[12px]"
        >
          <Skeleton className="size-[54px] rounded-xl" />
          <Skeleton className="h-2.5 w-12 rounded" />
        </div>
      ))}
    </div>
  )
}
