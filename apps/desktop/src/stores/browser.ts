import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface BrowserState {
  /** 当前浏览目录；空字符串表示还没完成启动校验 */
  path: string
  setPath: (path: string) => void
}

export const useBrowserStore = create<BrowserState>()(
  persist(
    (set) => ({
      path: '',
      setPath: (path) => set({ path }),
    }),
    {
      name: 'mie-iconner.browser.v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ path: state.path }),
    },
  ),
)

/** 返回上一级；根目录保持不动 */
export function parentPath(path: string): string {
  if (!path || path === '/') return '/'
  const trimmed = path.replace(/\/+$/, '')
  const parent = trimmed.slice(0, trimmed.lastIndexOf('/'))
  return parent || '/'
}
