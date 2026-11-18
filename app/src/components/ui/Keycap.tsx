import { cn } from '@/lib/cn'

export function Keycap({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-line bg-white/75 px-1 text-[10px] font-medium leading-none text-ink-3 shadow-[0_1px_0_rgb(122_92_62_/_0.10)]',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-3.5 animate-spin rounded-full border-[1.6px] border-current border-t-transparent opacity-70',
        className,
      )}
    />
  )
}
