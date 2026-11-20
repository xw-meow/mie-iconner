import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import type { ApplyActions } from '@/features/apply/useApplyActions'
import { FolderCard } from '@/features/folders/FolderCard'
import { useDesignStore } from '@/stores/design'
import { useSelectionStore } from '@/stores/selection'
import type { FolderItem } from '@/types/api'

vi.mock('@/features/thumbnails/useThumbnail', () => ({
  useThumbnail: () => ({ data: null, isLoading: false, isError: true }),
}))

vi.mock('@/lib/system', () => ({
  revealInFinder: vi.fn(),
  copyPath: vi.fn(),
}))

const folder: FolderItem = {
  path: '/Users/me/Desktop/其他',
  name: '其他',
  hasCustomIcon: false,
  iconModified: null,
}

const actions = {
  icon: null,
  folder: null,
  canApply: false,
  canRestore: false,
  isApplying: false,
  isRestoring: false,
  apply: vi.fn(),
  applyTo: vi.fn(),
  restore: vi.fn(),
  restoreOn: vi.fn(),
} as unknown as ApplyActions

describe('FolderCard', () => {
  beforeEach(() => {
    useSelectionStore.setState({ icon: null, folder: null, applied: null })
    useDesignStore.setState({ target: null })
  })

  it('opens the design studio from the context menu', async () => {
    const user = userEvent.setup()
    render(<FolderCard folder={folder} actions={actions} onOpen={() => {}} />)

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: /其他/ }),
    })
    await user.click(
      await screen.findByRole('menuitem', { name: '自定义设计' }),
    )

    expect(useDesignStore.getState().target?.path).toBe(folder.path)
  })
})
