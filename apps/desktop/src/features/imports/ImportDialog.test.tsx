import { beforeEach, describe, expect, it, vi } from 'vitest'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { ImportDialog } from '@/features/imports/ImportDialog'
import { useImportStore } from '@/stores/import'
import { useSelectionStore } from '@/stores/selection'
import { useUIStore } from '@/stores/ui'

const mocks = vi.hoisted(() => {
  const importedIcon = {
    path: '/custom/default/new.png',
    name: 'new',
    source: 'custom' as const,
    modified: 10,
  }
  const category = {
    name: 'default',
    icons: [],
    config: {
      priority: 0,
      author: null,
      authorUrl: null,
      brandName: null,
      brandColor: null,
      defaultExpanded: false,
    },
  }
  return { importedIcon, category }
})

const { importedIcon } = mocks

vi.mock('@/features/queries', () => ({
  useLibraryQuery: () => ({
    data: { bundled: [], custom: [mocks.category] },
    isLoading: false,
  }),
}))

vi.mock('@/lib/api', () => ({
  api: {
    importIcons: vi.fn(),
    createCategory: vi.fn(),
  },
}))

vi.mock('@/lib/system', () => ({
  pickImages: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/toast', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}))

import { api } from '@/lib/api'

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ImportDialog />
    </QueryClientProvider>,
  )
}

describe('ImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.importIcons).mockResolvedValue({
      imported: [importedIcon],
      failed: [],
    })
    vi.mocked(api.createCategory).mockResolvedValue('旅行')
    useImportStore.setState({
      open: true,
      files: ['/tmp/new.png'],
      category: 'default',
    })
    useSelectionStore.setState({ icon: null, folder: null, applied: null })
    useUIStore.setState({ tab: 'system' })
  })

  it('imports preset files into the selected category', async () => {
    const user = userEvent.setup()
    renderDialog()

    expect(await screen.findByText('导入贴纸')).toBeInTheDocument()
    expect(screen.getByText('已选择 1 张图片')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /导入 1 张/ }))

    await waitFor(() => {
      expect(api.importIcons).toHaveBeenCalledWith(['/tmp/new.png'], 'default')
    })
    await waitFor(() => {
      expect(useImportStore.getState().open).toBe(false)
    })
    expect(useUIStore.getState().tab).toBe('custom')
    expect(useSelectionStore.getState().icon?.path).toBe(importedIcon.path)
  })

  it('creates an empty category when no files were preset', async () => {
    useImportStore.setState({
      open: true,
      files: [],
      category: null,
    })
    const user = userEvent.setup()
    renderDialog()

    // 只有一个已有分类时默认选中它；切到新建分类
    await user.click(screen.getByRole('button', { name: /新建分类/ }))
    await user.type(screen.getByPlaceholderText(/分类名称/), '旅行')
    await user.click(screen.getByRole('button', { name: /只创建分类/ }))

    await waitFor(() => {
      expect(api.createCategory).toHaveBeenCalledWith('旅行')
    })
  })
})
