import { memo } from 'react'
import {
  Copy,
  FolderOpen,
  FolderSearch,
  RotateCcw,
  Sparkles,
} from 'lucide-react'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import { FolderGlyph } from '@/components/ui/FolderGlyph'
import { ThumbImage } from '@/features/thumbnails/ThumbImage'
import type { ApplyActions } from '@/features/apply/useApplyActions'
import { cn } from '@/lib/cn'
import { copyPath, revealInFinder } from '@/lib/system'
import { useSelectionStore } from '@/stores/selection'
import type { FolderItem } from '@/types/api'

interface FolderCardProps {
  folder: FolderItem
  actions: ApplyActions
  onOpen: (folder: FolderItem) => void
}

function FolderCardView({ folder, actions, onOpen }: FolderCardProps) {
  const selected = useSelectionStore(
    (state) => state.folder?.path === folder.path,
  )
  const applied = useSelectionStore((state) => state.applied?.path === folder.path)
  const selectFolder = useSelectionStore((state) => state.selectFolder)

  const hasIcon = folder.hasCustomIcon && folder.iconModified !== null

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          data-folder-card
          data-selected={selected}
          data-applied={applied}
          aria-pressed={selected}
          title={folder.path}
          onClick={() => selectFolder(folder)}
          onDoubleClick={() => onOpen(folder)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onOpen(folder)
            }
          }}
          className={cn(
            'folder-card group relative flex h-[104px] w-full min-w-0 select-none flex-col items-center justify-start gap-1.5 rounded-[12px] px-1.5 pb-1.5 pt-2.5 outline-none transition-colors duration-150',
            'focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
            selected
              ? 'bg-brand-tint/75 ring-1 ring-brand/55'
              : 'hover:bg-white/80',
          )}
        >
          <span
            className={cn(
              'relative flex size-[54px] items-center justify-center transition-[filter,transform] duration-200',
              selected
                ? 'drop-shadow-[0_5px_12px_rgb(255_92_56_/_0.3)]'
                : 'group-hover:-translate-y-0.5 group-hover:drop-shadow-[0_6px_12px_rgb(122_92_62_/_0.28)]',
            )}
          >
            {hasIcon ? (
              <ThumbImage
                path={folder.path}
                kind="folder"
                version={folder.iconModified}
                alt={folder.name}
                className="size-full"
                placeholder={<FolderGlyph size={54} />}
              />
            ) : (
              <FolderGlyph size={54} />
            )}
            {folder.hasCustomIcon ? (
              <span
                title="已设置自定义图标"
                className="absolute right-0 top-0 size-[7px] rounded-full bg-brand ring-2 ring-surface"
              />
            ) : null}
          </span>

          <span className="flex h-[30px] w-full items-center justify-center">
            <span
              className={cn(
                'line-clamp-2 text-center text-[11.5px] leading-[15px]',
                selected ? 'text-ink' : 'text-ink-2',
              )}
            >
              {folder.name}
            </span>
          </span>
        </button>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem
          icon={<FolderOpen className="size-3.5" />}
          onSelect={() => onOpen(folder)}
        >
          打开
        </ContextMenuItem>
        <ContextMenuItem
          icon={<Sparkles className="size-3.5" />}
          disabled={!actions.icon}
          onSelect={() => actions.applyTo(folder)}
        >
          应用当前贴纸
        </ContextMenuItem>
        <ContextMenuItem
          icon={<RotateCcw className="size-3.5" />}
          disabled={!folder.hasCustomIcon}
          onSelect={() => actions.restoreOn(folder)}
        >
          还原默认图标
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          icon={<FolderSearch className="size-3.5" />}
          onSelect={() => void revealInFinder(folder.path)}
        >
          在访达中显示
        </ContextMenuItem>
        <ContextMenuItem
          icon={<Copy className="size-3.5" />}
          onSelect={() => void copyPath(folder.path)}
        >
          拷贝路径
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export const FolderCard = memo(FolderCardView)
