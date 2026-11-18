import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'

import { cn } from '@/lib/cn'

export const ContextMenu = ContextMenuPrimitive.Root
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger

export function ContextMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn(
          'menu-content z-[85] min-w-[192px] rounded-xl border border-line bg-surface-raised p-1.5 shadow-panel-strong',
          className,
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  )
}

interface MenuItemProps
  extends React.ComponentProps<typeof ContextMenuPrimitive.Item> {
  icon?: React.ReactNode
  danger?: boolean
  shortcut?: string
}

export function ContextMenuItem({
  icon,
  danger,
  shortcut,
  className,
  children,
  ...props
}: MenuItemProps) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        'flex h-8 cursor-default select-none items-center gap-2 rounded-lg px-2.5 text-[12.5px] outline-none transition-colors',
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
    </ContextMenuPrimitive.Item>
  )
}

export function ContextMenuSeparator(
  props: React.ComponentProps<typeof ContextMenuPrimitive.Separator>,
) {
  return (
    <ContextMenuPrimitive.Separator
      className="my-1 h-px bg-line/80"
      {...props}
    />
  )
}

export function ContextMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Label>) {
  return (
    <ContextMenuPrimitive.Label
      className={cn(
        'px-2.5 pb-1 pt-1.5 text-[10.5px] font-medium tracking-wide text-ink-3',
        className,
      )}
      {...props}
    />
  )
}
