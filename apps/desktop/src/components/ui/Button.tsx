import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  [
    'relative inline-flex select-none items-center justify-center gap-1.5',
    'whitespace-nowrap font-rounded font-semibold',
    'transition-colors duration-150',
    'outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
    'disabled:pointer-events-none',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-brand text-white hover:bg-brand-dark active:bg-brand-dark disabled:opacity-40',
        secondary:
          'border border-line bg-white text-ink hover:border-line-strong hover:bg-hover disabled:opacity-45',
        ghost:
          'text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40',
        soft: 'bg-brand-tint text-brand hover:bg-brand-soft disabled:opacity-45',
        danger:
          'bg-danger text-white hover:bg-danger-dark active:bg-danger-dark disabled:opacity-40',
      },
      size: {
        sm: 'h-7 min-w-[48px] rounded-[10px] px-3 text-[12px]',
        md: 'h-8 min-w-[60px] rounded-[10px] px-3.5 text-[13px]',
        lg: 'h-9 min-w-[72px] rounded-[10px] px-4 text-[13px]',
        icon: 'size-7 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    )
  },
)

