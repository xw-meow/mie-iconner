import { beforeEach, describe, expect, it, vi } from 'vitest'

import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { StickerCard } from '@/features/library/StickerCard'
import { useSelectionStore } from '@/stores/selection'
import type { IconItem } from '@/types/api'

vi.mock('@/features/thumbnails/useThumbnail', () => ({
  useThumbnail: () => ({ data: null, isLoading: false, isError: true }),
}))

vi.mock('@/lib/system', () => ({
  revealInFinder: vi.fn(),
  copyPath: vi.fn(),
}))

const icon: IconItem = {
  path: '/icons/狐狸.png',
  name: '狐狸',
  source: 'custom',
  modified: 1,
}

describe('StickerCard', () => {
  beforeEach(() => {
    useSelectionStore.setState({
      icon: null,
      folder: null,
      applied: null,
    })
  })

  it('selects the sticker on click', async () => {
    const user = userEvent.setup()
    render(<StickerCard icon={icon} editable onDelete={() => {}} />)

    const card = screen.getByRole('button', { name: /狐狸/ })
    await user.click(card)

    expect(useSelectionStore.getState().icon?.path).toBe(icon.path)
  })

  it('marks the current selection with aria-pressed', () => {
    useSelectionStore.setState({ icon })
    render(<StickerCard icon={icon} editable onDelete={() => {}} />)
    expect(screen.getByRole('button', { name: /狐狸/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
