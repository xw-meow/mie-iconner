import { create } from 'zustand'

interface DragState {
  active: boolean
  /** 当前拖拽经过的自定义分类名 */
  category: string | null
  setActive: (active: boolean) => void
  setCategory: (category: string | null) => void
  reset: () => void
}

export const useDragStore = create<DragState>((set) => ({
  active: false,
  category: null,
  setActive: (active) => set({ active }),
  setCategory: (category) => set({ category }),
  reset: () => set({ active: false, category: null }),
}))
