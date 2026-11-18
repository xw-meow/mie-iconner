import { Fragment, useMemo } from 'react'
import { ChevronRight, Home, MoreHorizontal } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useEnvQuery } from '@/features/queries'
import { cn } from '@/lib/cn'
import { buildBreadcrumbs, type Breadcrumb } from '@/lib/format'
import { useBrowserStore } from '@/stores/browser'

type CrumbItem =
  | Breadcrumb
  | { label: '…'; path: '…'; kind: 'ellipsis'; hidden: Breadcrumb[] }

export function Breadcrumbs() {
  const path = useBrowserStore((state) => state.path)
  const setPath = useBrowserStore((state) => state.setPath)
  const { data: env } = useEnvQuery()

  const crumbs = useMemo(
    () => buildBreadcrumbs(path, env?.home ?? '/'),
    [path, env?.home],
  )

  const items: CrumbItem[] = useMemo(() => {
    if (crumbs.length <= 4) return crumbs
    return [
      crumbs[0],
      {
        label: '…',
        path: '…',
        kind: 'ellipsis',
        hidden: crumbs.slice(1, -2),
      },
      ...crumbs.slice(-2),
    ]
  }, [crumbs])

  if (!path) return null

  return (
    <nav
      aria-label="当前路径"
      className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden"
    >
      {items.map((crumb, index) => {
        const isLast = index === items.length - 1
        return (
          <Fragment key={`${crumb.kind}-${crumb.path}-${index}`}>
            {index > 0 ? (
              <ChevronRight
                className="size-3 shrink-0 text-ink-3/60"
                strokeWidth={2}
              />
            ) : null}

            {crumb.kind === 'ellipsis' ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="显示隐藏的路径层级"
                    className="flex h-6 shrink-0 items-center rounded-md px-1 text-ink-3 transition-colors hover:bg-hover hover:text-ink"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-w-[320px]">
                  {crumb.hidden.map((hidden) => (
                    <DropdownMenuItem
                      key={hidden.path}
                      onSelect={() => setPath(hidden.path)}
                    >
                      {hidden.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                type="button"
                aria-current={isLast ? 'page' : undefined}
                title={crumb.path}
                onClick={() => {
                  if (!isLast) setPath(crumb.path)
                }}
                className={cn(
                  'flex h-6 min-w-0 shrink items-center gap-1 rounded-md px-1.5 text-[11.5px] transition-colors',
                  isLast
                    ? 'font-semibold text-ink'
                    : 'text-ink-2 hover:bg-hover hover:text-ink',
                )}
              >
                {crumb.kind === 'home' ? (
                  <Home className="size-3 shrink-0 text-ink-3" strokeWidth={2} />
                ) : null}
                <span className="min-w-0 truncate">{crumb.label}</span>
              </button>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
