import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { cn } from '@/lib/cn'

export const Dialog = DialogPrimitive.Root

interface DialogShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

/**
 * 应用中所有弹窗的统一骨架：居中卡片、标题区、内容区、分隔线底栏。
 * 复用一份焦点陷阱/ESC/点击遮罩关闭与动画，业务弹窗只关心内容。
 */
export function DialogShell({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  footer,
  className,
}: DialogShellProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay fixed inset-0 z-[70] flex items-center justify-center bg-[rgb(44_38_32_/_0.26)] p-6 backdrop-blur-[2px]">
          <DialogPrimitive.Content
            className={cn(
              'dialog-content relative w-full max-w-[420px] overflow-hidden rounded-panel border border-line bg-surface-raised shadow-panel-strong outline-none',
              className,
            )}
          >
            <div className="flex items-start gap-3 px-5 pb-4 pt-5">
              {icon ? (
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand">
                  {icon}
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="font-rounded text-[15px] font-semibold leading-6 text-ink">
                  {title}
                </DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="mt-0.5 text-[12px] leading-5 text-ink-2">
                    {description}
                  </DialogPrimitive.Description>
                ) : (
                  <DialogPrimitive.Description className="sr-only">
                    {typeof title === 'string' ? title : '对话框'}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close
                aria-label="关闭"
                className="ml-1 -mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/35"
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
            </div>

            {children ? <div className="px-5 pb-5">{children}</div> : null}

            {footer ? (
              <div className="flex items-center justify-end gap-2 border-t border-line/70 bg-[#fdfaf4] px-5 py-3.5">
                {footer}
              </div>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
