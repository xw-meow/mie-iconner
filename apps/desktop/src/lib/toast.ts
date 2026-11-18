import { toast } from 'sonner'

/** 统一的轻量提示入口，避免各组件各写一套 duration/描述样式 */
export function notifySuccess(title: string, description?: string): void {
  toast.success(title, { description, duration: 2400 })
}

export function notifyError(title: string, description?: string): void {
  toast.error(title, { description, duration: 3200 })
}
