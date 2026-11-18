import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { DialogShell } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Keycap'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel: string
  destructive?: boolean
  pending?: boolean
  onConfirm: () => void
}

/** 通用二次确认弹窗：删除分类、重启 Finder 等不可逆/有副作用的操作 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <DialogShell
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
      icon={<AlertTriangle className="size-4" />}
      title={title}
      description={description}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            取消
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? <Spinner /> : null}
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
