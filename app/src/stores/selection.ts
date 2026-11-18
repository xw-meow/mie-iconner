import { create } from 'zustand'
import type { FolderItem, IconItem } from '@/types/api'

interface AppliedMark {
  path: string
  nonce: number
}

interface SelectionState {
  icon: IconItem | null
  folder: FolderItem | null
  /** 刚应用成功的文件夹，用于卡片脉冲动画 */
  applied: AppliedMark | null
  selectIcon: (icon: IconItem | null) => void
  selectFolder: (folder: FolderItem | null) => void
  clear: () => void
  clearFolder: () => void
  markApplied: (path: string) => void
  clearApplied: () => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  icon: null,
  folder: null,
  applied: null,
  selectIcon: (icon) => set({ icon }),
  selectFolder: (folder) => set({ folder }),
  clear: () => set({ icon: null, folder: null }),
  clearFolder: () => set({ folder: null }),
  markApplied: (path) =>
    set((state) => ({
      applied: { path, nonce: (state.applied?.nonce ?? 0) + 1 },
    })),
  clearApplied: () => set({ applied: null }),
}))
