import { describe, expect, it, vi } from 'vitest'

import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { ComposeBar } from '@/features/apply/ComposeBar'
import type { ApplyActions } from '@/features/apply/useApplyActions'
import type { FolderItem, IconItem } from '@/types/api'

vi.mock('@/features/thumbnails/useThumbnail', () => ({
  useThumbnail: () => ({ data: 'asset://thumb.png', isLoading: false, isError: false }),
}))

function makeActions(overrides: Partial<ApplyActions> = {}): ApplyActions {
  return {
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
    ...overrides,
  } as ApplyActions
}

const folder: FolderItem = {
  path: '/Users/me/Desktop/工作',
  name: '工作',
  hasCustomIcon: false,
  iconModified: null,
}

const icon: IconItem = {
  path: '/icons/狐狸.png',
  name: '狐狸',
  source: 'bundled',
  modified: 1,
}

describe('ComposeBar', () => {
  it('shows placeholders and disables buttons when nothing is selected', () => {
    render(<ComposeBar actions={makeActions()} />)
    expect(screen.getByText('未选贴纸')).toBeInTheDocument()
    expect(screen.getByText('未选文件夹')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /应用/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /还原/ })).toBeDisabled()
  })

  it('shows names and triggers actions when ready', async () => {
    const user = userEvent.setup()
    const actions = makeActions({
      icon,
      folder,
      canApply: true,
      canRestore: true,
    })
    render(<ComposeBar actions={actions} />)

    expect(screen.getByText('狐狸')).toBeInTheDocument()
    expect(screen.getByText('工作')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /应用/ }))
    expect(actions.apply).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: /还原/ }))
    expect(actions.restore).toHaveBeenCalledTimes(1)
  })

  it('disables actions while applying', () => {
    const actions = makeActions({
      icon,
      folder,
      canApply: true,
      canRestore: true,
      isApplying: true,
    })
    render(<ComposeBar actions={actions} />)
    expect(screen.getByRole('button', { name: /应用中/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /还原/ })).toBeDisabled()
  })
})
