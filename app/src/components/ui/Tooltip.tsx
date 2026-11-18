import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { cn } from '@/lib/cn'

export const Tooltip = TooltipPrimitive.Root

export const TooltipTrigger = TooltipPrimitive.Trigger

export function TooltipContent({
  children,
  className,
  side = 'bottom',
  sideOffset = 7,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        side={side}
        sideOffset={sideOffset}
        className={cn(
          'tooltip-content z-[95] rounded-lg bg-ink px-2 py-1 text-[11px] font-medium leading-none text-white shadow-lift',
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-ink" width={8} height={4} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}
