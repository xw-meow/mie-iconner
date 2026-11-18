import { Plus } from 'lucide-react'

/** 网格末尾的虚线导入卡，与贴纸卡同尺寸 */
export function AddStickerTile({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="group flex h-[104px] w-full flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-line-strong/80 bg-white/25 text-ink-3 outline-none transition-colors hover:border-brand/45 hover:bg-brand-tint/45 hover:text-brand focus-visible:ring-2 focus-visible:ring-brand/35"
    >
      <Plus className="size-4" strokeWidth={2} />
      <span className="text-[10px] font-medium">添加</span>
    </button>
  )
}
