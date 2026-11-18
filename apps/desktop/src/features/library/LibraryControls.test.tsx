import { beforeEach, describe, expect, it } from 'vitest'

import { userEvent } from '@testing-library/user-event'
import { act, render, screen } from '@testing-library/react'

import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { LibrarySearch } from '@/features/library/LibrarySearch'
import { vi } from 'vitest'

describe('SegmentedControl', () => {
  it('renders counts and reports clicks', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl
        value="system"
        onChange={onChange}
        options={[
          { value: 'system', label: '系统预设', count: 12 },
          { value: 'custom', label: '我的贴纸', count: 3 },
        ]}
      />,
    )

    expect(screen.getByRole('tab', { name: /系统预设/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await user.click(screen.getByRole('tab', { name: /我的贴纸/ }))
    expect(onChange).toHaveBeenCalledWith('custom')
  })

  it('supports left/right arrow navigation', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl
        value="system"
        onChange={onChange}
        options={[
          { value: 'system', label: '系统预设' },
          { value: 'custom', label: '我的贴纸' },
        ]}
      />,
    )

    const active = screen.getByRole('tab', { name: '系统预设' })
    active.focus()
    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenCalledWith('custom')
  })
})

describe('LibrarySearch', () => {
  beforeEach(() => {
    // 事件总线是模块级的，测试之间无需清理；搜索框每次挂载都会重新订阅
  })

  it('emits value changes and clears on escape', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<LibrarySearch value="狐狸" onChange={onChange} />)

    const input = screen.getByRole('textbox', { name: '搜索贴纸' })
    expect(input).toHaveValue('狐狸')
    await user.click(input)
    await user.keyboard('{Escape}')
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('focuses via the global shortcut event', async () => {
    render(<LibrarySearch value="" onChange={() => {}} />)
    const { appEvents, APP_EVENT } = await import('@/lib/events')
    await act(async () => {
      appEvents.dispatchEvent(new Event(APP_EVENT.focusSearch))
    })
    expect(screen.getByRole('textbox', { name: '搜索贴纸' })).toHaveFocus()
  })
})
