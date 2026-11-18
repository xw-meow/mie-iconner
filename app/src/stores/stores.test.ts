import { describe, expect, it } from 'vitest'

import { parentPath } from '@/stores/browser'
import { useSelectionStore } from '@/stores/selection'

describe('parentPath', () => {
  it('walks up one level', () => {
    expect(parentPath('/Users/me/Desktop')).toBe('/Users/me')
    expect(parentPath('/Users')).toBe('/')
  })

  it('stays at root', () => {
    expect(parentPath('/')).toBe('/')
    expect(parentPath('')).toBe('/')
  })

  it('ignores trailing slashes', () => {
    expect(parentPath('/Users/me/Desktop/')).toBe('/Users/me')
  })
})

describe('selection store', () => {
  it('tracks icon and folder independently', () => {
    const store = useSelectionStore.getState()
    const icon = {
      path: '/icons/a.png',
      name: 'a',
      source: 'custom' as const,
      modified: 1,
    }
    const folder = {
      path: '/Users/me/Desktop/工作',
      name: '工作',
      hasCustomIcon: false,
      iconModified: null,
    }

    store.selectIcon(icon)
    store.selectFolder(folder)
    expect(useSelectionStore.getState().icon).toEqual(icon)
    expect(useSelectionStore.getState().folder).toEqual(folder)

    useSelectionStore.getState().clearFolder()
    expect(useSelectionStore.getState().folder).toBeNull()
    expect(useSelectionStore.getState().icon).toEqual(icon)

    useSelectionStore.getState().clear()
    expect(useSelectionStore.getState().icon).toBeNull()
  })

  it('increments the applied nonce', () => {
    useSelectionStore.getState().markApplied('/a')
    const first = useSelectionStore.getState().applied?.nonce
    useSelectionStore.getState().markApplied('/b')
    const second = useSelectionStore.getState().applied?.nonce
    expect(second).toBeGreaterThan(first ?? 0)
    useSelectionStore.getState().clearApplied()
    expect(useSelectionStore.getState().applied).toBeNull()
  })
})
