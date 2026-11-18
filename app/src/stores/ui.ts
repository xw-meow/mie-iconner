import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type LibraryTab = 'system' | 'custom'

interface UIState {
  tab: LibraryTab
  /** key = `${tab}:${categoryName}`；只存用户手动切换过的分类 */
  collapsed: Record<string, boolean>
  aboutOpen: boolean
  setTab: (tab: LibraryTab) => void
  toggleCategory: (key: string, currentlyCollapsed: boolean) => void
  setAboutOpen: (open: boolean) => void
}

export const categoryKey = (tab: LibraryTab, name: string): string =>
  `${tab}:${name}`

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      tab: 'system',
      collapsed: {},
      aboutOpen: false,
      setTab: (tab) => set({ tab }),
      toggleCategory: (key, currentlyCollapsed) =>
        set((state) => ({
          collapsed: { ...state.collapsed, [key]: !currentlyCollapsed },
        })),
      setAboutOpen: (open) => set({ aboutOpen: open }),
    }),
    {
      name: 'mie-iconner.ui.v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ tab: state.tab, collapsed: state.collapsed }),
    },
  ),
)
