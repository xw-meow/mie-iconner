import { useMemo, useState } from 'react'
import { GripVertical, ImagePlus, Search, SearchX, X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { filterCategories } from '@/features/library/filter'
import { useLibraryQuery } from '@/features/queries'
import { ThumbImage } from '@/features/thumbnails/ThumbImage'
import { DESIGN_DRAG_MIME } from '@/features/design/model'
import { cn } from '@/lib/cn'
import { errorText } from '@/lib/errors'
import type { IconItem } from '@/types/api'

interface StickerDrawerProps {
  onAdd: (icon: IconItem) => void
  busy: boolean
}

/** 设计工作台左侧素材抽屉：点击或拖拽，把贴纸放进画布。 */
export function StickerDrawer({ onAdd, busy }: StickerDrawerProps) {
  const { data: library, isLoading, error, refetch } = useLibraryQuery()
  const [tab, setTab] = useState<'system' | 'custom'>('system')
  const [query, setQuery] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)

  const categories = useMemo(
    () => (tab === 'system' ? (library?.bundled ?? []) : (library?.custom ?? [])),
    [library, tab],
  )
  const filtered = useMemo(
    () => filterCategories(categories, query),
    [categories, query],
  )
  const searching = query.trim().length > 0
  const total = filtered.iconCount

  return (
    <aside className="flex w-[236px] shrink-0 flex-col border-r border-line bg-canvas-top">
      <header className="shrink-0 px-3.5 pb-2 pt-3.5">
        <div className="flex items-center justify-between">
          <h2 className="font-rounded text-[13.5px] font-bold text-ink">贴纸素材</h2>
          <span className="flex items-center gap-1 text-[10px] text-ink-3">
            <GripVertical className="size-3" />
            拖到画布
          </span>
        </div>
        <SegmentedControl
          className="mt-2.5"
          value={tab}
          options={[
            { value: 'system', label: '系统预设' },
            { value: 'custom', label: '我的贴纸' },
          ]}
          onChange={(next) => {
            setTab(next)
            setQuery('')
          }}
        />
        <div className="mt-2 flex h-8 items-center gap-1.5 rounded-[9px] border border-line bg-white px-2.5 transition-[border-color,box-shadow] duration-150 focus-within:border-brand/55 focus-within:shadow-[0_0_0_3px_rgb(255_92_56_/_0.09)]">
          <Search className="size-3.5 shrink-0 text-ink-3" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="找一张贴纸"
            aria-label="搜索贴纸"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-3"
          />
          {query ? (
            <button
              type="button"
              aria-label="清除搜索"
              onClick={() => setQuery('')}
              className="flex size-4 items-center justify-center rounded-full text-ink-3 hover:bg-hover hover:text-ink"
            >
              <X className="size-3" strokeWidth={2.2} />
            </button>
          ) : null}
        </div>
      </header>

      <div className="scroll-area min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-5">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {Array.from({ length: 12 }).map((_, index) => (
              <Skeleton key={index} className="aspect-square rounded-[9px]" />
            ))}
          </div>
        ) : error ? (
          <div className="pt-12">
            <EmptyState
              icon={<ImagePlus className="size-5" />}
              title="素材加载失败"
              description={errorText(error)}
              action={
                <Button size="sm" onClick={() => void refetch()}>
                  重试
                </Button>
              }
            />
          </div>
        ) : total === 0 ? (
          <div className="pt-12">
            <EmptyState
              icon={searching ? <SearchX className="size-5" /> : <ImagePlus className="size-5" />}
              title={searching ? '没有匹配的贴纸' : '这个分类还没有贴纸'}
              description={
                searching
                  ? '换个关键词，或切换上方来源。'
                  : tab === 'custom'
                    ? '回到贴纸册导入自己的图片。'
                    : '系统素材缺失，重新打开应用试试。'
              }
              action={
                searching ? (
                  <Button size="sm" variant="secondary" onClick={() => setQuery('')}>
                    清除搜索
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.categories.map((category) => (
              <section key={category.name}>
                <div className="flex items-center gap-1.5 px-0.5 pb-1.5 pt-1">
                  <h3 className="min-w-0 truncate text-[11px] font-semibold text-ink-2">
                    {category.name}
                  </h3>
                  <span className="h-px min-w-2 flex-1 bg-line/80" />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {category.icons.map((icon) => (
                    <StickerButton
                      key={icon.path}
                      icon={icon}
                      busy={busy}
                      dragging={dragging === icon.path}
                      onAdd={() => onAdd(icon)}
                      onDragStart={() => setDragging(icon.path)}
                      onDragEnd={() => setDragging(null)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function StickerButton({
  icon,
  busy,
  dragging,
  onAdd,
  onDragStart,
  onDragEnd,
}: {
  icon: IconItem
  busy: boolean
  dragging: boolean
  onAdd: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  return (
    <button
      type="button"
      data-design-sticker
      draggable={!busy}
      disabled={busy}
      title={`${icon.name} · 点击或拖到画布`}
      onClick={onAdd}
      onDragStart={(event) => {
        event.dataTransfer.setData(DESIGN_DRAG_MIME, JSON.stringify(icon))
        event.dataTransfer.setData('text/plain', icon.path)
        event.dataTransfer.effectAllowed = 'copy'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative flex aspect-square items-center justify-center rounded-[9px] border border-line/80 bg-white p-1.5 outline-none transition-[border-color,box-shadow,transform] duration-150',
        'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_6px_12px_-8px_rgb(122_92_62_/_0.45)]',
        'focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-1',
        'disabled:cursor-progress disabled:opacity-50',
        dragging && 'border-brand/60 opacity-45',
      )}
    >
      <ThumbImage
        path={icon.path}
        kind="image"
        version={icon.modified}
        alt={icon.name}
        className="size-full"
      />
    </button>
  )
}
