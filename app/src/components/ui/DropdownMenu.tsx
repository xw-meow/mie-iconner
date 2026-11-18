import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'

import { cn } from '@/lib/cn'

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = 'end',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'menu-content z-[85] min-w-[196px] rounded-xl border border-line bg-surface-raised p-1.5 shadow-panel-strong',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

interface DropdownItemProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.Item> {
  icon?: React.ReactNode
  danger?: boolean
  shortcut?: string
}

export function DropdownMenuItem({
  icon,
  danger,
  shortcut,
  className,
  children,
  ...props
}: DropdownItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'flex h-8 select-none items-center gap-2 rounded-lg px-2.5 text-[12.5px] outline-none transition-colors',
        danger
          ? 'text-danger data-[highlighted]:bg-danger-soft'
          : 'text-ink data-[highlighted]:bg-hover',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className={cn('flex size-4 items-center justify-center', danger ? 'text-danger' : 'text-ink-3')}>
          {icon}
        </span>
      ) : null}
      <span className="flex-1 truncate">{children}</span>
      {shortcut ? (
        <span className="text-[10.5px] tracking-wide text-ink-3">{shortcut}</span>
      ) : null}
    </DropdownMenuPrimitive.Item>
  )
}

export function DropdownMenuSeparator(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>,
) {
  return (
    <DropdownMenuPrimitive.Separator
      className="my-1 h-px bg-line/80"
      {...props}
    />
  )
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(
        'px-2.5 pb-1 pt-1.5 text-[10.5px] font-medium tracking-wide text-ink-3',
        className,
      )}
      {...props}
    />
  )
}
