import { safeHexColor } from '@/lib/format'

/** config.json 的 brandName：antd Tag 风格的小徽标，颜色由作者指定 */
export function BrandBadge({
  name,
  color,
}: {
  name: string
  color: string | null | undefined
}) {
  return (
    <span
      className="inline-flex h-[16px] shrink-0 items-center rounded-[4px] px-1.5 text-[9.5px] font-semibold leading-none tracking-[0.02em] text-white"
      style={{ backgroundColor: safeHexColor(color) }}
    >
      {name}
    </span>
  )
}

export function CountPill({ value }: { value: number }) {
  return (
    <span className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-slot/80 px-1 text-[10px] font-semibold tabular-nums text-ink-3">
      {value}
    </span>
  )
}
