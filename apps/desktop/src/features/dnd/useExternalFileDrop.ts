import { useEffect } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'

import { notifyError } from '@/lib/toast'
import { useDragStore } from '@/stores/drag'
import { useImportStore } from '@/stores/import'

const IMAGE_EXTENSION = /\.(png|jpe?g)$/i

/** 物理像素 → CSS 像素后命中当前指针下的自定义分类 */
function categoryAt(position: { x: number; y: number }): string | null {
  const ratio = window.devicePixelRatio || 1
  const element = document.elementFromPoint(position.x / ratio, position.y / ratio)
  const target = element?.closest<HTMLElement>('[data-drop-category]')
  if (!target || target.dataset.dropSource !== 'custom') return null
  return target.dataset.dropCategory ?? null
}

/**
 * 接收从 Finder 拖进来的图片：
 * 拖拽经过时高亮目标分类；松手后带着文件直接打开导入弹窗。
 * 用 Tauri 的原生 drag-drop 事件（HTML5 File API 拿不到真实路径）。
 */
export function useExternalFileDrop(enabled = true) {
  const setActive = useDragStore((state) => state.setActive)
  const setCategory = useDragStore((state) => state.setCategory)
  const reset = useDragStore((state) => state.reset)
  const openImport = useImportStore((state) => state.openImport)

  useEffect(() => {
    if (!enabled) return
    let unlisten: (() => void) | undefined
    let cancelled = false

    void getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload
        if (payload.type === 'enter' || payload.type === 'over') {
          setActive(true)
          setCategory(categoryAt(payload.position))
          return
        }
        if (payload.type === 'drop') {
          const category = categoryAt(payload.position)
          const images = payload.paths.filter((path) => IMAGE_EXTENSION.test(path))
          reset()
          if (images.length === 0) {
            notifyError('只能导入 PNG / JPG 图片')
            return
          }
          openImport({ files: images, category })
          return
        }
        reset()
      })
      .then((dispose) => {
        if (cancelled) dispose()
        else unlisten = dispose
      })

    return () => {
      cancelled = true
      unlisten?.()
      reset()
    }
  }, [enabled, openImport, reset, setActive, setCategory])
}
