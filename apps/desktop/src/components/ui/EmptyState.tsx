import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-10 text-center',
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl border border-line/80 bg-white/70 text-ink-3 shadow-[0_6px_16px_-12px_rgb(122_92_62_/_0.5)]">
        {icon}
      </div>
      <p className="mt-3 font-rounded text-[13px] font-semibold text-ink">
        {title}
      </p>
      {description ? (
        <p className="mt-1 max-w-[240px] text-[11.5px] leading-5 text-ink-3">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-3.5">{action}</div> : null}
    </div>
  )
}
