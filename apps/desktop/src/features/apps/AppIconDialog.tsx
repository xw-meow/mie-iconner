import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AppWindow,
  LayoutGrid,
  Lock,
  RotateCcw,
  Search,
  SearchX,
  Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { DialogShell } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Keycap'
import { useAppsQuery } from '@/features/queries'
import { ThumbImage } from '@/features/thumbnails/ThumbImage'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { errorText } from '@/lib/errors'
import { notifyError, notifySuccess } from '@/lib/toast'
import { useSelectionStore } from '@/stores/selection'
import type { AppItem, IconItem } from '@/types/api'

const EMPTY_APPS: AppItem[] = []

interface AppIconDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 独立入口：浏览系统里已安装的 App，把当前选中的贴纸写成 App 的
 * Finder 自定义图标。只读 App 走 macOS 管理员授权，系统应用受 SIP 保护。
 */
export function AppIconDialog({ open, onOpenChange }: AppIconDialogProps) {
  const queryClient = useQueryClient()
  const sticker = useSelectionStore((state) => state.icon)
  const [query, setQuery] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const appsQuery = useAppsQuery(open)
  const apps = appsQuery.data ?? EMPTY_APPS

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return apps
    return apps.filter((app) =>
      `${app.name} ${app.path} ${app.bundleId ?? ''}`
        .toLowerCase()
        .includes(keyword),
    )
  }, [apps, query])

  const selected = apps.find((app) => app.path === selectedPath) ?? null
  const pending = appsQuery.isFetching && !appsQuery.isLoading

  const apply = useMutation({
    mutationFn: ({
      app,
      icon,
      admin,
    }: {
      app: AppItem
      icon: IconItem
      admin: boolean
    }) => api.applyAppIcon(icon.path, app.path, admin),
    onSuccess: (_, { app }) => {
      notifySuccess(
        `已换好「${app.name}」的图标`,
        'Finder 会重新读取图标；Dock/Launchpad 有缓存，必要时用右上角强刷',
      )
      void queryClient.invalidateQueries({ queryKey: ['apps'] })
    },
    onError: (error, { app }) => {
      notifyError(`没能修改「${app.name}」的图标`, errorText(error))
    },
  })

  const restore = useMutation({
    mutationFn: ({ app, admin }: { app: AppItem; admin: boolean }) =>
      api.restoreAppIcon(app.path, admin),
    onSuccess: (_, { app }) => {
      notifySuccess(`已还原「${app.name}」`, 'App 已恢复系统默认图标')
      void queryClient.invalidateQueries({ queryKey: ['apps'] })
    },
    onError: (error, { app }) => {
      notifyError(`没能还原「${app.name}」`, errorText(error))
    },
  })

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setQuery('')
      setSelectedPath(null)
    }
    onOpenChange(next)
  }

  const busy = apply.isPending || restore.isPending
  const canApply = Boolean(sticker && selected && !selected.system && !busy)
  const canRestore = Boolean(selected?.hasCustomIcon && !selected.system && !busy)

  return (
    <DialogShell
      open={open}
      onOpenChange={handleOpenChange}
      icon={<LayoutGrid className="size-4" />}
      title="应用图标"
      description="给已安装的 App 换一张 Finder 图标。只读 App 会请求 macOS 管理员授权。"
      className="max-w-[820px]"
      footer={
        <>
          <div className="mr-auto flex min-w-0 items-center gap-2 text-[11px] text-ink-3">
            {selected ? (
              <>
                <span className="min-w-0 truncate">已选：{selected.name}</span>
                {selected.system ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-ink-3">
                    <Lock className="size-3" />
                    系统应用受 SIP 保护
                  </span>
                ) : !selected.modifiable ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-ink-3">
                    <Lock className="size-3" />
                    应用/还原时请求管理员授权
                  </span>
                ) : null}
              </>
            ) : (
              <span>选择一个 App</span>
            )}
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() =>
              selected &&
              restore.mutate({ app: selected, admin: !selected.modifiable })
            }
            disabled={!canRestore}
          >
            {restore.isPending ? (
              <Spinner />
            ) : (
              <RotateCcw className="size-3.5" strokeWidth={2.1} />
            )}
            还原默认
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() =>
              selected &&
              sticker &&
              apply.mutate({
                app: selected,
                icon: sticker,
                admin: !selected.modifiable,
              })
            }
            disabled={!canApply}
            className="min-w-[96px]"
          >
            {apply.isPending ? (
              <Spinner />
            ) : (
              <Sparkles className="size-3.5" strokeWidth={2.1} />
            )}
            {apply.isPending ? '应用中…' : '应用贴纸'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex h-9 items-center gap-2 rounded-[10px] border border-line bg-white px-3 transition-[border-color,box-shadow] duration-150 focus-within:border-brand/55 focus-within:shadow-[0_0_0_3px_rgb(255_92_56_/_0.09)]">
          <Search className="size-3.5 shrink-0 text-ink-3" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索 App"
            aria-label="搜索已安装的 App"
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-3"
          />
          {apps.length > 0 ? (
            <span className="shrink-0 text-[10px] tabular-nums text-ink-3">
              {filtered.length}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 rounded-[10px] bg-canvas-top px-2.5 py-2">
          {sticker ? (
            <>
              <ThumbImage
                path={sticker.path}
                kind="image"
                version={sticker.modified}
                alt={sticker.name}
                className="size-7 shrink-0 rounded-[6px]"
              />
              <span className="min-w-0 truncate text-[11.5px] text-ink-2">
                当前贴纸：{sticker.name}
              </span>
              <span className="ml-auto shrink-0 text-[10.5px] text-ink-3">
                点选 App 后应用
              </span>
            </>
          ) : (
            <>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-[6px] border border-dashed border-line-strong/80 bg-white/50 text-ink-3">
                <Sparkles className="size-3.5" />
              </span>
              <span className="min-w-0 text-[11.5px] text-ink-2">
                还没有选贴纸
              </span>
              <span className="ml-auto shrink-0 text-[10.5px] text-ink-3">
                关闭后从左侧贴纸册挑一张
              </span>
            </>
          )}
        </div>

        {appsQuery.isLoading ? (
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 15 }).map((_, index) => (
              <Skeleton key={index} className="h-[102px] rounded-[10px]" />
            ))}
          </div>
        ) : appsQuery.isError ? (
          <EmptyState
            icon={<AppWindow className="size-5" />}
            title="读取应用列表失败"
            description={errorText(appsQuery.error)}
            action={
              <Button size="sm" onClick={() => void appsQuery.refetch()}>
                重新加载
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={query.trim() ? <SearchX className="size-5" /> : <AppWindow className="size-5" />}
            title={query.trim() ? '没有匹配的 App' : '没有找到已安装的 App'}
            description={
              query.trim()
                ? '换个关键词试试，也可以搜 Bundle ID。'
                : '应用通常位于 /Applications 或 ~/Applications。'
            }
            action={
              query.trim() ? (
                <Button size="sm" variant="secondary" onClick={() => setQuery('')}>
                  清除搜索
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div
            className={cn(
              'scroll-area max-h-[52vh] overflow-y-auto pr-1',
              pending && 'opacity-70',
            )}
          >
            <div className="grid grid-cols-5 gap-2">
              {filtered.map((app) => (
                <AppCard
                  key={app.path}
                  app={app}
                  selected={app.path === selectedPath}
                  onSelect={() => setSelectedPath(app.path)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </DialogShell>
  )
}

function AppCard({
  app,
  selected,
  onSelect,
}: {
  app: AppItem
  selected: boolean
  onSelect: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === 'undefined',
  )

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '160px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <button
      ref={ref}
      type="button"
      data-app-card
      aria-pressed={selected}
      title={app.path}
      onClick={onSelect}
      className={cn(
        'group relative flex h-[102px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[10px] border px-1.5 py-2 outline-none transition-colors duration-150',
        'focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        selected
          ? 'border-brand/70 bg-brand-tint/65'
          : 'border-line bg-white hover:border-line-strong',
      )}
    >
      <span className="relative flex size-[46px] items-center justify-center">
        <ThumbImage
          path={app.path}
          kind="app"
          version={app.iconModified}
          alt={app.name}
          enabled={visible}
          className="size-full"
          placeholder={
            <AppWindow className="size-8 text-ink-3/60" strokeWidth={1.6} />
          }
        />
        {app.hasCustomIcon ? (
          <span className="absolute right-0 top-0 size-[7px] rounded-full bg-brand ring-2 ring-white" />
        ) : null}
        {!app.modifiable ? (
          <span
            title={app.system ? '系统应用受 SIP 保护' : '修改时需要管理员授权'}
            className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border border-line bg-white text-ink-3"
          >
            <Lock className="size-2.5" />
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          'line-clamp-2 w-full text-center text-[10.5px] leading-4',
          selected ? 'text-ink' : 'text-ink-2',
        )}
      >
        {app.name}
      </span>
    </button>
  )
}
