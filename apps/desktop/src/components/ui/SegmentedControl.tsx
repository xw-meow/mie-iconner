import { cn } from '@/lib/cn'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  count?: number
}

interface SegmentedControlProps<T extends string> {
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
  className?: string
}

/**
 * 纸质分段控件：暖灰凹槽 + 滑动的白色选中胶囊。
 * 指示块用 transform 过渡而不是每个按钮各自换背景，
 * 切换时视觉上是一块「纸片」滑过去。
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const width = `calc((100% - 6px) / ${options.length})`

  return (
    <div
      role="tablist"
      aria-label="贴纸分类来源"
      className={cn(
        'relative grid gap-0.5 rounded-full bg-slot p-[3px]',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[3px] left-[3px] top-[3px] rounded-full bg-white shadow-[0_1px_3px_rgb(122_92_62_/_0.18)] transition-transform duration-200 ease-out"
        style={{ width, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault()
                const delta = event.key === 'ArrowRight' ? 1 : -1
                const next =
                  options[(index + delta + options.length) % options.length]
                onChange(next.value)
              }
            }}
            className={cn(
              'relative z-10 flex h-[27px] items-center justify-center gap-1.5 rounded-full font-rounded text-[12px] font-medium transition-colors duration-150',
              active ? 'text-ink' : 'text-ink-2 hover:text-ink',
            )}
          >
            <span>{option.label}</span>
            {typeof option.count === 'number' ? (
              <span
                className={cn(
                  'min-w-[16px] rounded-full px-1 text-center text-[10px] font-semibold leading-[15px] transition-colors',
                  active ? 'bg-brand-tint text-brand' : 'bg-white/55 text-ink-3',
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
