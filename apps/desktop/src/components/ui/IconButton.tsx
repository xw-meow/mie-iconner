import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

import { Button, type ButtonProps } from '@/components/ui/Button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import { cn } from '@/lib/cn'

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'size'> {
  /** 无障碍名称，同时作为 tooltip 文案 */
  label: string
  children: React.ReactNode
  loading?: boolean
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, children, className, loading, tooltipSide = 'bottom', disabled, ...props },
    ref,
  ) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={ref}
            size="icon"
            aria-label={label}
            disabled={disabled || loading}
            className={cn('size-[30px] shrink-0', className)}
            {...props}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>{label}</TooltipContent>
      </Tooltip>
    )
  },
)
