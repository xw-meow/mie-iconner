import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  [
    'relative inline-flex select-none items-center justify-center gap-1.5',
    'whitespace-nowrap font-rounded font-semibold',
    'transition-[filter,background-color,border-color,color,box-shadow,transform] duration-150',
    'outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
    'active:scale-[0.97] disabled:pointer-events-none',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-b from-brand to-brand-dark text-white shadow-brand hover:brightness-105 active:brightness-95 disabled:opacity-40 disabled:shadow-none',
        secondary:
          'border border-line bg-white text-ink hover:border-line-strong hover:bg-hover disabled:opacity-45',
        ghost:
          'text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40',
        soft: 'bg-brand-tint text-brand hover:bg-brand-soft disabled:opacity-45',
        danger:
          'bg-danger text-white hover:brightness-105 disabled:opacity-40',
      },
      size: {
        sm: 'h-7 rounded-full px-3 text-[12px]',
        md: 'h-8 rounded-full px-3.5 text-[13px]',
        lg: 'h-9 rounded-full px-4 text-[13px]',
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

