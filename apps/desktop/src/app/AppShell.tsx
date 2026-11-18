import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { CheckCircle2, CircleAlert, Info, Loader2 } from 'lucide-react'
import { Toaster } from 'sonner'

import { BootSplash } from '@/app/BootSplash'
import { ComposeBar } from '@/features/apply/ComposeBar'
import { useApplyActions } from '@/features/apply/useApplyActions'
import { TopBar } from '@/features/chrome/TopBar'
import { DropOverlay } from '@/features/dnd/DropOverlay'
import { useExternalFileDrop } from '@/features/dnd/useExternalFileDrop'
import { FolderPanel } from '@/features/folders/FolderPanel'
import { ImportDialog } from '@/features/imports/ImportDialog'
import { LibraryPanel } from '@/features/library/LibraryPanel'
import { useEnvQuery } from '@/features/queries'
import { api } from '@/lib/api'
import { errorText } from '@/lib/errors'
import { APP_EVENT, emitAppEvent } from '@/lib/events'
import { parentPath, useBrowserStore } from '@/stores/browser'
import { useSelectionStore } from '@/stores/selection'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipPrimitive.Provider delayDuration={450} skipDelayDuration={200}>
        {children}
        <Toaster
          position="bottom-center"
          offset={94}
          gap={8}
          closeButton={false}
          icons={{
            success: <CheckCircle2 className="size-4 text-[#8fd8a9]" />,
            error: <CircleAlert className="size-4 text-[#ff9b85]" />,
            info: <Info className="size-4 text-white/70" />,
            loading: <Loader2 className="size-4 animate-spin text-white/70" />,
          }}
          toastOptions={{ duration: 2400 }}
        />
      </TooltipPrimitive.Provider>
    </QueryClientProvider>
  )
}

export function AppShell() {
  const { data: env, error: envError, refetch: refetchEnv } = useEnvQuery()
  const path = useBrowserStore((state) => state.path)
  const setPath = useBrowserStore((state) => state.setPath)
  const actions = useApplyActions()
  const [booted, setBooted] = useState(false)

  useExternalFileDrop()

  // 启动时校验上次目录；失效则依次回退桌面 / 家目录。
  // 不用 ref 锁：StrictMode 会取消首轮 effect，靠 booted 状态允许重跑。
  useEffect(() => {
    if (!env || booted) return
    let cancelled = false
    void (async () => {
      const candidate = path || env.desktop || env.home
      let resolved = await api.resolvePath(candidate)
      if (!resolved) resolved = await api.resolvePath(env.desktop)
      if (!resolved) resolved = await api.resolvePath(env.home)
      if (cancelled) return
      if (resolved) setPath(resolved.path)
      setBooted(true)
    })()
    return () => {
      cancelled = true
    }
  }, [env, path, setPath, booted])

  // 切换目录就清掉文件夹选中；贴纸选中保留，方便连续贴到多个文件夹
  useEffect(() => {
    useSelectionStore.getState().clearFolder()
  }, [path])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const editing =
        target?.closest('input, textarea, [contenteditable="true"]') != null
      const overlayOpen =
        document.querySelector('[role="dialog"], [role="menu"]') !== null
      const command = event.metaKey

      if (command && (event.key === 'l' || event.key === 'L')) {
        event.preventDefault()
        emitAppEvent(APP_EVENT.focusOmnibox)
        return
      }
      if (command && (event.key === 'f' || event.key === 'F')) {
        event.preventDefault()
        emitAppEvent(APP_EVENT.focusSearch)
        return
      }
      if (overlayOpen) return

      if (command && event.key === 'ArrowUp' && !editing) {
        event.preventDefault()
        setPath(parentPath(useBrowserStore.getState().path))
        return
      }
      if (command && event.key === 'Enter' && !editing) {
        event.preventDefault()
        actions.apply()
        return
      }
      if (event.key === 'Escape' && !editing) {
        useSelectionStore.getState().clear()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [actions, setPath])

  if (!env) {
    return (
      <BootSplash
        error={envError ? errorText(envError) : null}
        onRetry={envError ? () => void refetchEnv() : undefined}
      />
    )
  }

  if (!booted) {
    return <BootSplash error={null} />
  }

  return (
    <div className="app-canvas flex h-full min-h-0 flex-col overflow-hidden">
      <TopBar />
      <main className="paper-panel mx-3 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel">
        <div className="flex min-h-0 flex-1">
          <LibraryPanel />
          <FolderPanel actions={actions} />
        </div>
        <ComposeBar actions={actions} />
      </main>
      <ImportDialog />
      <DropOverlay />
    </div>
  )
}
