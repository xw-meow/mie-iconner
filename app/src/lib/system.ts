import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { open } from '@tauri-apps/plugin-dialog'
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener'

import { errorText } from '@/lib/errors'
import { notifyError, notifySuccess } from '@/lib/toast'

/** 在访达中选中文件/文件夹 */
export async function revealInFinder(path: string): Promise<void> {
  try {
    await revealItemInDir(path)
  } catch (error) {
    notifyError('无法在访达中显示', errorText(error))
  }
}

/** 复制路径到剪贴板 */
export async function copyPath(path: string): Promise<void> {
  try {
    await writeText(path)
    notifySuccess('路径已复制')
  } catch (error) {
    notifyError('复制失败', errorText(error))
  }
}

/** 只允许 http(s) 外部链接，避免把 webview 导航到奇怪协议 */
export async function openExternal(url: string): Promise<void> {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return
    await openUrl(url)
  } catch (error) {
    notifyError('无法打开链接', errorText(error))
  }
}

/** 原生「选择文件夹」面板 */
export async function pickFolder(): Promise<string | null> {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择文件夹',
    })
    return typeof selected === 'string' ? selected : null
  } catch (error) {
    notifyError('无法打开文件夹选择器', errorText(error))
    return null
  }
}

/** 原生「选择图片」面板，仅 PNG / JPG */
export async function pickImages(): Promise<string[]> {
  try {
    const selected = await open({
      directory: false,
      multiple: true,
      title: '选择贴纸图片',
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg'] }],
    })
    if (!selected) return []
    return Array.isArray(selected) ? selected : [selected]
  } catch (error) {
    notifyError('无法打开图片选择器', errorText(error))
    return []
  }
}
