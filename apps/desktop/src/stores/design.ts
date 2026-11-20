import { create } from 'zustand'
import type { FolderItem } from '@/types/api'

interface DesignState {
  /** 正在设计的文件夹；非空时 AppShell 切到全屏设计工作台 */
  target: FolderItem | null
  openDesign: (folder: FolderItem) => void
  closeDesign: () => void
}

export const useDesignStore = create<DesignState>((set) => ({
  target: null,
  openDesign: (target) => set({ target }),
  closeDesign: () => set({ target: null }),
}))
