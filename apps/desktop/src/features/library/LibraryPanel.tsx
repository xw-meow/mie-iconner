import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Plus, RefreshCw, SearchX } from 'lucide-react'

import { CountPill } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { CategorySection } from '@/features/library/CategorySection'
import { filterCategories } from '@/features/library/filter'
import { LibrarySearch } from '@/features/library/LibrarySearch'
import { useLibraryQuery } from '@/features/queries'
import { api } from '@/lib/api'
import { errorText } from '@/lib/errors'
import { notifyError, notifySuccess } from '@/lib/toast'
import { useDragStore } from '@/stores/drag'
import { useImportStore } from '@/stores/import'
import { useSelectionStore } from '@/stores/selection'
import { categoryKey, useUIStore, type LibraryTab } from '@/stores/ui'
import type { Category, IconItem } from '@/types/api'

export function LibraryPanel() {
  const queryClient = useQueryClient()
  const { data: library, isLoading, error, refetch } = useLibraryQuery()
  const tab = useUIStore((state) => state.tab)
  const setTab = useUIStore((state) => state.setTab)
  const collapsedMap = useUIStore((state) => state.collapsed)
  const toggleCategory = useUIStore((state) => state.toggleCategory)
  const clearSelection = useSelectionStore((state) => state.clear)
  const openImport = useImportStore((state) => state.openImport)
  const dragActive = useDragStore((state) => state.active)
  const dragCategory = useDragStore((state) => state.category)

  const [query, setQuery] = useState('')
  const [pendingCategory, setPendingCategory] = useState<string | null>(null)

  const deleteIcon = useMutation({
    mutationFn: (icon: IconItem) => api.deleteIcon(icon.path),
    onSuccess: (_, icon) => {
      const selection = useSelectionStore.getState()
      if (selection.icon?.path === icon.path) selection.selectIcon(null)
      void queryClient.invalidateQueries({ queryKey: ['library'] })
      notifySuccess('已移到废纸篓', icon.name)
    },
    onError: (mutationError) => {
      notifyError('删除贴纸失败', errorText(mutationError))
    },
  })

  const deleteCategory = useMutation({
    mutationFn: (name: string) => api.deleteCategory(name),
    onSuccess: (_, name) => {
      const selection = useSelectionStore.getState()
      if (
        selection.icon?.source === 'custom' &&
        selection.icon.path.split('/').slice(-2, -1)[0] === name
      ) {
        selection.selectIcon(null)
      }
      void queryClient.invalidateQueries({ queryKey: ['library'] })
      notifySuccess(`已删除分类「${name}」`, '分类文件夹已移到废纸篓')
      setPendingCategory(null)
    },
    onError: (mutationError) => {
      notifyError('删除分类失败', errorText(mutationError))
    },
  })

  const categories: Category[] = useMemo(
    () => (tab === 'system' ? (library?.bundled ?? []) : (library?.custom ?? [])),
    [library, tab],
  )
  const totals = useMemo(() => {
    const bundled =
      library?.bundled.reduce((sum, category) => sum + category.icons.length, 0) ?? 0
    const custom =
      library?.custom.reduce((sum, category) => sum + category.icons.length, 0) ?? 0
    return { bundled, custom }
  }, [library])

  const filtered = useMemo(
    () => filterCategories(categories, query),
    [categories, query],
  )
  const searching = query.trim().length > 0

  const handleTabs = useCallback(
    (value: LibraryTab) => {
      setTab(value)
      setQuery('')
    },
    [setTab],
  )

  const handleBlankMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement
      if (
        target.closest(
          '[data-sticker-card],[data-category-header],button,a,input',
        )
      ) {
        return
      }
      clearSelection()
    },
    [clearSelection],
  )

  const handleDeleteCategory = useCallback((name: string) => {
    setPendingCategory(name)
  }, [])

  return (
    <section className="paper-panel flex w-[344px] shrink-0 flex-col overflow-hidden rounded-panel">
      <header className="shrink-0 px-3.5 pb-2.5 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="font-rounded text-[16px] font-bold tracking-[-0.01em] text-ink">
              贴纸册
            </h1>
            <CountPill value={tab === 'system' ? totals.bundled : totals.custom} />
          </div>
          <Button
            variant="soft"
            size="sm"
            className="h-7 gap-1 px-2.5"
            onClick={() => openImport()}
          >
            <Plus className="size-3.5" strokeWidth={2.2} />
            导入
          </Button>
        </div>

        <SegmentedControl
          className="mt-3"
          value={tab}
          onChange={handleTabs}
          options={[
            { value: 'system', label: '系统预设', count: totals.bundled },
            { value: 'custom', label: '我的贴纸', count: totals.custom },
          ]}
        />

        <div className="mt-2.5">
          <LibrarySearch value={query} onChange={setQuery} />
        </div>
      </header>

      <div
        className="scroll-area min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-8"
        onMouseDown={handleBlankMouseDown}
      >
        {isLoading ? (
          <LibrarySkeleton />
        ) : error ? (
          <EmptyState
            icon={<RefreshCw className="size-5" />}
            title="贴纸库加载失败"
            description={errorText(error)}
            action={
              <Button size="sm" onClick={() => void refetch()}>
                重新加载
              </Button>
            }
            className="pt-20"
          />
        ) : filtered.categories.length === 0 ? (
          <LibraryEmpty
            searching={searching}
            tab={tab}
            onClearSearch={() => setQuery('')}
            onImport={() => openImport()}
          />
        ) : (
          <>
            {searching ? (
              <p className="px-1.5 pb-1.5 pt-1 text-[10.5px] text-ink-3">
                找到 {filtered.iconCount} 张贴纸
              </p>
            ) : null}
            <div className="flex flex-col gap-1.5">
              {filtered.categories.map((category) => {
                const key = categoryKey(tab, category.name)
                const userChoice = collapsedMap[key]
                const collapsed = searching
                  ? false
                  : (userChoice ?? !category.config.defaultExpanded)
                return (
                  <CategorySection
                    key={category.name}
                    category={category}
                    editable={tab === 'custom'}
                    collapsed={collapsed}
                    searching={searching}
                    isDropTarget={
                      tab === 'custom' &&
                      dragActive &&
                      dragCategory === category.name
                    }
                    onToggle={() => toggleCategory(key, collapsed)}
                    onAdd={() =>
                      openImport({ category: category.name })
                    }
                    onDeleteCategory={() =>
                      handleDeleteCategory(category.name)
                    }
                    onDeleteIcon={(icon) => deleteIcon.mutate(icon)}
                  />
                )
              })}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={pendingCategory !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCategory(null)
        }}
        title="删除分类"
        description={`「${pendingCategory ?? ''}」及其中的贴纸会被移到废纸篓。`}
        confirmLabel="移到废纸篓"
        destructive
        pending={deleteCategory.isPending}
        onConfirm={() => {
          if (pendingCategory) deleteCategory.mutate(pendingCategory)
        }}
      />
    </section>
  )
}

function LibrarySkeleton() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      {[0, 1].map((section) => (
        <div key={section} className="space-y-2">
          <div className="flex items-center gap-2 px-1.5">
            <Skeleton className="size-3 rounded" />
            <Skeleton className="h-3.5 w-20 rounded" />
            <Skeleton className="h-3 w-6 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: section === 0 ? 6 : 3 }).map((_, index) => (
              <Skeleton key={index} className="h-[104px] rounded-[10px]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function LibraryEmpty({
  searching,
  tab,
  onClearSearch,
  onImport,
}: {
  searching: boolean
  tab: LibraryTab
  onClearSearch: () => void
  onImport: () => void
}) {
  if (searching) {
    return (
      <EmptyState
        icon={<SearchX className="size-5" />}
        title="没有找到匹配的贴纸"
        description="换个关键词试试，分类名也可以搜。"
        action={
          <Button size="sm" variant="secondary" onClick={onClearSearch}>
            清除搜索
          </Button>
        }
        className="pt-20"
      />
    )
  }

  if (tab === 'custom') {
    return (
      <EmptyState
        icon={<ImagePlus className="size-5" />}
        title="还没有自己的贴纸"
        description="导入 PNG / JPG 图片，或者直接从 Finder 拖进来。"
        action={
          <Button size="sm" variant="primary" onClick={onImport}>
            <Plus className="size-3.5" />
            导入贴纸
          </Button>
        }
        className="pt-20"
      />
    )
  }

  return (
    <EmptyState
      icon={<ImagePlus className="size-5" />}
      title="暂无系统预设贴纸"
      description="应用内置贴纸资源缺失，试试重新打开应用。"
      className="pt-20"
    />
  )
}
