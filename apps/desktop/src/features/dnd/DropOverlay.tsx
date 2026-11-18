import { ImagePlus } from 'lucide-react'

import { cn } from '@/lib/cn'
import { useDragStore } from '@/stores/drag'

/** Finder 拖拽文件经过窗口时的全屏提示层（pointer-events: none，不妨碍命中检测） */
export function DropOverlay() {
  const active = useDragStore((state) => state.active)
  const category = useDragStore((state) => state.category)

  if (!active) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex animate-fade-in items-center justify-center bg-canvas-top/55 backdrop-blur-[3px]">
      <div
        className={cn(
          'flex flex-col items-center gap-2.5 rounded-[20px] border-2 border-dashed bg-white/90 px-10 py-7 shadow-panel-strong',
          category ? 'border-brand/65' : 'border-line-strong',
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-tint text-brand">
          <ImagePlus className="size-5" strokeWidth={1.9} />
        </div>
        <p className="font-rounded text-[15px] font-semibold text-ink">
          {category ? `松手，导入到「${category}」` : '把图片拖到左侧的分类上'}
        </p>
        <p className="text-[11.5px] text-ink-3">
          {category ? '图片会复制进「我的贴纸」' : '也可以松手后再选择分类'}
        </p>
      </div>
    </div>
  )
}
