import { ArrowRight, Folder, RotateCcw, Sparkles, Sticker } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { FolderGlyph } from '@/components/ui/FolderGlyph'
import { Keycap, Spinner } from '@/components/ui/Keycap'
import type { ApplyActions } from '@/features/apply/useApplyActions'
import { ThumbImage } from '@/features/thumbnails/ThumbImage'
import { cn } from '@/lib/cn'
import type { FolderItem, IconItem } from '@/types/api'

interface ComposeBarProps {
  actions: ApplyActions
}

/** 底部「贴纸 → 文件夹」组合台：选择、预览、应用/还原都收在这一条里 */
export function ComposeBar({ actions }: ComposeBarProps) {
  const { icon, folder, canApply, canRestore, apply, restore, isApplying, isRestoring } =
    actions
  const ready = canApply

  return (
    <footer className="shrink-0 px-3 pb-3 pt-3">
      <div
        className={cn(
          'paper-panel flex h-[68px] items-center gap-3 rounded-panel px-3.5 transition-[box-shadow,border-color] duration-300',
          ready && 'border-brand/25 shadow-panel-strong',
        )}
      >
        <StickerSlot icon={icon} />
        <ArrowRight
          className={cn(
            'size-3.5 shrink-0 transition-colors',
            ready ? 'text-brand' : 'text-ink-3/50',
          )}
          strokeWidth={2}
        />
        <FolderSlot folder={folder} />

        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          {ready ? (
            <span className="hidden items-center gap-1 text-[10.5px] text-ink-3 min-[1080px]:flex">
              <Keycap>⌘</Keycap>
              <Keycap>↩</Keycap>
              <span className="ml-0.5">应用</span>
            </span>
          ) : null}

          <Button
            variant="secondary"
            size="md"
            onClick={restore}
            disabled={!canRestore || isRestoring || isApplying}
          >
            {isRestoring ? (
              <Spinner />
            ) : (
              <RotateCcw className="size-3.5" strokeWidth={2.1} />
            )}
            还原
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={apply}
            disabled={!canApply || isApplying || isRestoring}
            className="min-w-[96px]"
          >
            {isApplying ? (
              <Spinner />
            ) : (
              <Sparkles className="size-3.5" strokeWidth={2.1} />
            )}
            {isApplying ? '应用中…' : '应用'}
          </Button>
        </div>
      </div>
    </footer>
  )
}

function StickerSlot({ icon }: { icon: IconItem | null }) {
  if (!icon) {
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-dashed border-line-strong/80 bg-hover/40 text-ink-3">
          <Sticker className="size-4" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] leading-4 text-ink-3">未选贴纸</p>
          <p className="text-[10px] leading-4 text-ink-3/80">从左侧挑一张</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="size-10 shrink-0 overflow-hidden rounded-[10px] border border-line bg-white p-1 shadow-[0_2px_6px_-4px_rgb(122_92_62_/_0.5)]">
        <ThumbImage
          path={icon.path}
          kind="image"
          version={icon.modified}
          alt={icon.name}
          className="size-full"
        />
      </div>
      <div className="min-w-0">
        <p
          className="truncate text-[12.5px] font-semibold leading-4 text-ink"
          title={icon.name}
        >
          {icon.name}
        </p>
        <p className="text-[10px] leading-4 text-ink-3">
          {icon.source === 'bundled' ? '系统预设' : '我的贴纸'}
        </p>
      </div>
    </div>
  )
}

function FolderSlot({ folder }: { folder: FolderItem | null }) {
  if (!folder) {
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-dashed border-line-strong/80 bg-hover/40 text-ink-3">
          <Folder className="size-4" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] leading-4 text-ink-3">未选文件夹</p>
          <p className="text-[10px] leading-4 text-ink-3/80">在右侧点选一个</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex size-10 shrink-0 items-center justify-center">
        {folder.hasCustomIcon && folder.iconModified !== null ? (
          <ThumbImage
            path={folder.path}
            kind="folder"
            version={folder.iconModified}
            alt={folder.name}
            className="size-9"
            placeholder={<FolderGlyph size={34} />}
          />
        ) : (
          <FolderGlyph size={36} />
        )}
      </div>
      <div className="min-w-0">
        <p
          className="max-w-[200px] truncate text-[12.5px] font-semibold leading-4 text-ink"
          title={folder.path}
        >
          {folder.name}
        </p>
        <p className="text-[10px] leading-4 text-ink-3">
          {folder.hasCustomIcon ? '已有自定义图标' : '文件夹'}
        </p>
      </div>
    </div>
  )
}
