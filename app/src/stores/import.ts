import { create } from 'zustand'

interface ImportDialogState {
  open: boolean
  /** 从 Finder 拖入、或从分类的 + 号进入时预设的文件 */
  files: string[]
  /** 预设目标分类；null 表示交给弹窗自行选择 */
  category: string | null
  openImport: (options?: { files?: string[]; category?: string | null }) => void
  close: () => void
}

export const useImportStore = create<ImportDialogState>((set) => ({
  open: false,
  files: [],
  category: null,
  openImport: (options) =>
    set({
      open: true,
      files: options?.files ?? [],
      category: options?.category ?? null,
    }),
  close: () => set({ open: false, files: [], category: null }),
}))
