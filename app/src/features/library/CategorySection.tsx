import { memo } from 'react'
import {
  ChevronRight,
  MoreHorizontal,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react'

import { BrandBadge } from '@/components/ui/Badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { AddStickerTile } from '@/features/library/AddStickerTile'
import { StickerCard } from '@/features/library/StickerCard'
import { cn } from '@/lib/cn'
import { openExternal } from '@/lib/system'
import type { Category, IconItem } from '@/types/api'

interface CategorySectionProps {
  category: Category
  editable: boolean
  collapsed: boolean
  searching: boolean
  isDropTarget: boolean
  onToggle: () => void
  onAdd: () => void
  onDeleteCategory: () => void
  onDeleteIcon: (icon: IconItem) => void
}

function CategorySectionView({
  category,
  editable,
  collapsed,
  searching,
  isDropTarget,
  onToggle,
  onAdd,
  onDeleteCategory,
  onDeleteIcon,
}: CategorySectionProps) {
  const hasAuthor = Boolean(category.config.author || category.config.authorUrl)
  const authorUrl = category.config.authorUrl

  return (
    <section
      data-drop-category={editable ? category.name : undefined}
      data-drop-source={editable ? 'custom' : undefined}
      className={cn(
        'group/section relative rounded-[12px] transition-colors',
        isDropTarget && 'bg-brand-tint/45',
      )}
    >
      {isDropTarget ? (
        <div className="pointer-events-none absolute inset-0 z-20 rounded-[12px] border-2 border-dashed border-brand/65" />
      ) : null}

      <div
        data-category-header
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onToggle()
          }
        }}
        className={cn(
          'flex h-[30px] select-none items-center gap-1.5 rounded-lg px-1.5 outline-none transition-colors',
          'hover:bg-hover focus-visible:bg-hover focus-visible:ring-1 focus-visible:ring-brand/30',
        )}
      >
        <ChevronRight
          className={cn(
            'size-3 shrink-0 text-ink-3 transition-transform duration-200',
            !collapsed && 'rotate-90',
          )}
          strokeWidth={2.4}
        />
        <span className="min-w-0 truncate font-rounded text-[13px] font-semibold text-ink">
          {category.name}
        </span>
        {category.config.brandName ? (
          <BrandBadge
            name={category.config.brandName}
            color={category.config.brandColor}
          />
        ) : null}
        <span className="shrink-0 text-[10.5px] tabular-nums text-ink-3">
          {category.icons.length}
        </span>

        <div
          className={cn(
            'ml-auto flex shrink-0 items-center gap-0.5 transition-opacity duration-150',
            'opacity-0 group-hover/section:opacity-100 focus-within:opacity-100',
          )}
        >
          {editable && !searching ? (
            <button
              type="button"
              title={`添加贴纸到「${category.name}」`}
              aria-label={`添加贴纸到「${category.name}」`}
              onClick={(event) => {
                event.stopPropagation()
                onAdd()
              }}
              onKeyDown={(event) => event.stopPropagation()}
              className="flex size-6 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-white hover:text-brand"
            >
              <Plus className="size-3.5" strokeWidth={2.2} />
            </button>
          ) : null}
          {editable ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title={`「${category.name}」的更多操作`}
                  aria-label={`「${category.name}」的更多操作`}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  className="flex size-6 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-white hover:text-ink"
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  icon={<Plus className="size-3.5" />}
                  onSelect={onAdd}
                >
                  添加贴纸到此分类
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  icon={<Trash2 className="size-3.5" />}
                  danger
                  onSelect={onDeleteCategory}
                >
                  删除分类…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-1 pb-2 pt-1">
            {hasAuthor ? (
              <div className="flex h-4 items-center gap-1 px-1.5 pb-1 text-[10.5px] text-ink-3">
                <UserRound className="size-2.5 shrink-0" strokeWidth={2} />
                {authorUrl ? (
                  <button
                    type="button"
                    onClick={() => void openExternal(authorUrl)}
                    className="min-w-0 truncate text-left underline-offset-2 transition-colors hover:text-brand hover:underline"
                    title={authorUrl}
                  >
                    {category.config.author || authorUrl}
                  </button>
                ) : (
                  <span className="min-w-0 truncate">
                    {category.config.author}
                  </span>
                )}
              </div>
            ) : null}

            {category.icons.length > 0 || (editable && !searching) ? (
              <div className="grid grid-cols-3 gap-2">
                {category.icons.map((icon) => (
                  <StickerCard
                    key={icon.path}
                    icon={icon}
                    editable={editable}
                    onDelete={onDeleteIcon}
                  />
                ))}
                {editable && !searching ? (
                  <AddStickerTile onAdd={onAdd} />
                ) : null}
              </div>
            ) : (
              <p className="px-1.5 py-2 text-[11px] text-ink-3">
                {searching ? '没有匹配的贴纸' : '这个分类还没有贴纸'}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export const CategorySection = memo(CategorySectionView)
