import { beforeEach, describe, expect, it, vi } from 'vitest'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AppIconDialog } from '@/features/apps/AppIconDialog'
import { useSelectionStore } from '@/stores/selection'
import type { IconItem } from '@/types/api'

const mocks = vi.hoisted(() => {
  const app = {
    path: '/Applications/Demo.app',
    name: 'Demo',
    bundleId: 'com.example.demo',
    hasCustomIcon: false,
    iconModified: 1,
    modifiable: true,
    system: false,
  }
  const locked = {
    path: '/Applications/Locked.app',
    name: 'Locked',
    bundleId: 'com.example.locked',
    hasCustomIcon: false,
    iconModified: 1,
    modifiable: false,
    system: false,
  }
  const system = {
    path: '/System/Applications/System.app',
    name: 'System',
    bundleId: 'com.apple.system',
    hasCustomIcon: false,
    iconModified: 1,
    modifiable: false,
    system: true,
  }
  return {
    app,
    locked,
    system,
    applyAppIcon: vi.fn().mockResolvedValue(undefined),
    restoreAppIcon: vi.fn().mockResolvedValue(undefined),
  }
})

const { app, locked } = mocks

const icon: IconItem = {
  path: '/icons/fox.png',
  name: '狐狸',
  source: 'bundled',
  modified: 1,
}

vi.mock('@/features/queries', () => ({
  useAppsQuery: () => ({
    data: [mocks.app, mocks.locked, mocks.system],
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

vi.mock('@/features/thumbnails/useThumbnail', () => ({
  useThumbnail: () => ({
    data: 'asset://thumb.png',
    isLoading: false,
    isError: false,
  }),
}))

vi.mock('@/lib/api', () => ({
  api: {
    applyAppIcon: mocks.applyAppIcon,
    restoreAppIcon: mocks.restoreAppIcon,
  },
}))

vi.mock('@/lib/toast', () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}))

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AppIconDialog open onOpenChange={() => {}} />
    </QueryClientProvider>,
  )
}

describe('AppIconDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSelectionStore.setState({ icon, folder: null, applied: null })
  })

  it('applies the selected sticker to a writable app', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: /Demo/ }))
    const apply = screen.getByRole('button', { name: /应用贴纸/ })
    expect(apply).toBeEnabled()
    await user.click(apply)

    await waitFor(() => {
      expect(mocks.applyAppIcon).toHaveBeenCalledWith(icon.path, app.path, false)
    })
  })

  it('uses admin authorization for a read-only app', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: /Locked/ }))
    expect(screen.getByText('应用/还原时请求管理员授权')).toBeInTheDocument()
    const apply = screen.getByRole('button', { name: /应用贴纸/ })
    expect(apply).toBeEnabled()
    await user.click(apply)

    await waitFor(() => {
      expect(mocks.applyAppIcon).toHaveBeenCalledWith(
        icon.path,
        locked.path,
        true,
      )
    })
  })

  it('disables applying to a SIP-protected system app', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: /System/ }))
    expect(screen.getByText('系统应用受 SIP 保护')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /应用贴纸/ })).toBeDisabled()
  })

  it('disables applying when there is no sticker', () => {
    useSelectionStore.setState({ icon: null })
    renderDialog()

    expect(screen.getByText('还没有选贴纸')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /应用贴纸/ })).toBeDisabled()
  })
})
