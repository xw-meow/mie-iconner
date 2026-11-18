import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 合并条件 class，并让后写的 Tailwind 工具类覆盖前面的冲突项 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
