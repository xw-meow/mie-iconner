import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  FolderOpen,
  FolderSearch,
  Info,
  MoreHorizontal,
  RefreshCcw,
} from 'lucide-react'

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { IconButton } from '@/components/ui/IconButton'
import { Omnibox } from '@/features/chrome/Omnibox'
import { AboutDialog } from '@/features/dialogs/AboutDialog'
import { api } from '@/lib/api'
import { errorText } from '@/lib/errors'
import { notifyError, notifySuccess } from '@/lib/toast'
import { pickFolder, revealInFinder } from '@/lib/system'
import { parentPath, useBrowserStore } from '@/stores/browser'
import { useUIStore } from '@/stores/ui'

export function TopBar() {
  const path = useBrowserStore((state) => state.path)
  const setPath = useBrowserStore((state) => state.setPath)
  const queryClient = useQueryClient()
  const setAboutOpen = useUIStore((state) => state.setAboutOpen)
  const [refreshOpen, setRefreshOpen] = useState(false)

  const atRoot = !path || path === '/'

  const restartFinder = useMutation({
    mutationFn: api.restartFinder,
    onSuccess: () => {
      setRefreshOpen(false)
      notifySuccess('桌面已刷新', 'Finder 已重新读取图标缓存')
      void queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
    onError: (error) => {
      notifyError('刷新桌面失败', errorText(error))
    },
  })

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

  return (
    <header
      data-tauri-drag-region
      className="relative z-30 flex h-14 shrink-0 select-none items-center gap-1.5 pl-[84px] pr-3"
    >
      <IconButton
        label="返回上一级"
        onClick={() => setPath(parentPath(path))}
        disabled={atRoot}
        variant="ghost"
      >
        <ChevronLeft className="size-4" strokeWidth={2.1} />
      </IconButton>

      <div className="mx-1 min-w-0 flex-1">
        <Omnibox />
      </div>

      <IconButton
        label="打开文件夹…"
        variant="ghost"
        onClick={() => void handlePickFolder()}
      >
        <FolderOpen className="size-4" strokeWidth={1.9} />
      </IconButton>

      <IconButton
        label="在访达中显示当前文件夹"
        variant="ghost"
        disabled={!path}
        onClick={() => path && void revealInFinder(path)}
      >
        <FolderSearch className="size-4" strokeWidth={1.9} />
      </IconButton>

      <IconButton
        label="刷新桌面图标"
        variant="ghost"
        loading={restartFinder.isPending}
        onClick={() => setRefreshOpen(true)}
      >
        <RefreshCcw className="size-4" strokeWidth={1.9} />
      </IconButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="更多操作"
            className="flex size-[30px] shrink-0 items-center justify-center rounded-full text-ink-2 outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/35"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            icon={<Info className="size-3.5" />}
            onSelect={() => setAboutOpen(true)}
          >
            关于小羊贴纸铺
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={refreshOpen}
        onOpenChange={setRefreshOpen}
        title="刷新桌面图标"
        description="这会重启 Finder 来重建图标缓存。已经打开的 Finder 窗口会关闭，桌面也会短暂闪一下。"
        confirmLabel="刷新桌面"
        pending={restartFinder.isPending}
        onConfirm={() => restartFinder.mutate()}
      />
      <AboutDialog />
    </header>
  )
}
