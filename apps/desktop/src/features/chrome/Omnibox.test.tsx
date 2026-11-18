import { beforeEach, describe, expect, it, vi } from 'vitest'

import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { Omnibox } from '@/features/chrome/Omnibox'
import { useBrowserStore } from '@/stores/browser'

const suggestion = {
  path: '/private/tmp',
  name: 'tmp',
  display: '/tmp',
}

vi.mock('@/features/queries', () => ({
  useEnvQuery: () => ({ data: { home: '/Users/me' } }),
  useSuggestionsQuery: () => ({
    data: [suggestion],
    isFetching: false,
    isError: false,
    error: null,
  }),
}))

vi.mock('@/lib/api', () => ({
  api: {
    resolvePath: vi.fn().mockResolvedValue({
      path: '/private/tmp',
      name: 'tmp',
      display: '/tmp',
    }),
  },
}))

vi.mock('@/lib/toast', () => ({
  notifyError: vi.fn(),
}))

import { api } from '@/lib/api'

describe('Omnibox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useBrowserStore.setState({ path: '/Users/me/Desktop' })
  })

  it('keeps the suggestion menu open after clicking the input', async () => {
    const user = userEvent.setup()
    render(<Omnibox />)

    const input = screen.getByRole('combobox')
    await user.click(input)

    expect(screen.getByRole('listbox')).not.toHaveClass('hidden')
    expect(screen.getByText('/tmp')).toBeInTheDocument()
  })

  it('navigates to the typed path on Enter', async () => {
    const user = userEvent.setup()
    render(<Omnibox />)

    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.keyboard('/tmp')
    await waitFor(() => expect(input).toHaveValue('/tmp'))
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(api.resolvePath).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(useBrowserStore.getState().path).toBe('/private/tmp')
    })
  })

  it('navigates to a highlighted suggestion on Enter', async () => {
    const user = userEvent.setup()
    render(<Omnibox />)

    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(api.resolvePath).toHaveBeenCalledWith(suggestion.path)
    })
  })
})
