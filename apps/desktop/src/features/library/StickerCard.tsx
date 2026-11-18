import { memo } from 'react'
import { Check, Copy, FolderSearch, Trash2 } from 'lucide-react'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import { ThumbImage } from '@/features/thumbnails/ThumbImage'
import { cn } from '@/lib/cn'
import { copyPath, revealInFinder } from '@/lib/system'
import { useSelectionStore } from '@/stores/selection'
import type { IconItem } from '@/types/api'

interface StickerCardProps {
  icon: IconItem
  editable: boolean
  onDelete: (icon: IconItem) => void
}

function StickerCardView({ icon, editable, onDelete }: StickerCardProps) {
  const selected = useSelectionStore((state) => state.icon?.path === icon.path)
  const selectIcon = useSelectionStore((state) => state.selectIcon)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          data-sticker-card
          data-selected={selected}
          aria-pressed={selected}
          title={icon.name}
          onClick={() => selectIcon(icon)}
          className={cn(
            'sticker-card group relative flex h-[104px] w-full min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] border px-1.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
            selected
              ? 'border-brand/70 bg-brand-tint/70 shadow-[0_8px_18px_-12px_rgb(232_74_31_/_0.55)]'
              : 'border-line bg-white hover:border-line-strong hover:shadow-sticker',
          )}
        >
          <span className="relative flex size-[54px] items-center justify-center">
            <ThumbImage
              path={icon.path}
              kind="image"
              version={icon.modified}
              alt={icon.name}
              className="size-full"
            />
            {selected ? (
              <span className="absolute -right-1.5 -top-1 flex size-[16px] items-center justify-center rounded-full bg-brand text-white shadow-[0_2px_5px_rgb(232_74_31_/_0.45)] animate-pop-in">
                <Check className="size-2.5" strokeWidth={3.2} />
              </span>
            ) : null}
          </span>
          <span
            className={cn(
              'w-full truncate text-center text-[10.5px] leading-4',
              selected ? 'text-ink' : 'text-ink-2',
            )}
          >
            {icon.name}
          </span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {editable ? (
          <>
            <ContextMenuItem
              icon={<Trash2 className="size-3.5" />}
              danger
              onSelect={() => onDelete(icon)}
            >
              删除贴纸
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        ) : null}
        <ContextMenuItem
          icon={<FolderSearch className="size-3.5" />}
          onSelect={() => void revealInFinder(icon.path)}
        >
          在访达中显示
        </ContextMenuItem>
        <ContextMenuItem
          icon={<Copy className="size-3.5" />}
          onSelect={() => void copyPath(icon.path)}
        >
          拷贝路径
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export const StickerCard = memo(StickerCardView)
