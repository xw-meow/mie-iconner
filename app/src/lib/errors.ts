import type { AppError } from '@/types/api'

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as AppError).message === 'string'
  )
}

/** 后端消息已是面向用户的中文；未知错误兜底到调用方给的文案 */
export function errorText(error: unknown, fallback = '操作失败，请重试'): string {
  if (isAppError(error)) return error.message
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}

export function errorCode(error: unknown): string | null {
  return isAppError(error) ? error.code : null
}

const IMPORT_FAILURE_LABELS: Record<string, string> = {
  invalid_name: '文件名不合法',
  unsupported_type: '仅支持 PNG / JPG',
  not_found: '文件不存在',
  overwrite_failed: '覆盖已有文件失败',
  copy_failed: '拷贝失败',
  invalid_category: '分类名不合法',
}

export function importFailureLabel(reason: string): string {
  return IMPORT_FAILURE_LABELS[reason] ?? '导入失败'
}
