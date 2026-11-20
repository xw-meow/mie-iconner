import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useDesignHistory } from '@/features/design/useDesignHistory'

describe('useDesignHistory', () => {
  it('undoes and redoes document edits', () => {
    const { result } = renderHook(() => useDesignHistory({ count: 0 }))

    act(() => {
      result.current.update(() => ({ count: 1 }))
    })
    act(() => {
      result.current.update(() => ({ count: 2 }))
    })

    expect(result.current.doc.count).toBe(2)
    expect(result.current.canUndo).toBe(true)

    act(() => result.current.undo())
    expect(result.current.doc.count).toBe(1)
    act(() => result.current.undo())
    expect(result.current.doc.count).toBe(0)
    expect(result.current.canUndo).toBe(false)

    act(() => result.current.redo())
    expect(result.current.doc.count).toBe(1)
    expect(result.current.canRedo).toBe(true)
  })

  it('coalesces rapid changes sharing a key', () => {
    const { result } = renderHook(() => useDesignHistory({ count: 0 }))

    act(() => {
      result.current.update(() => ({ count: 1 }), 'drag')
    })
    act(() => {
      result.current.update(() => ({ count: 2 }), 'drag')
    })
    act(() => {
      result.current.update(() => ({ count: 3 }), 'drag')
    })

    expect(result.current.doc.count).toBe(3)
    act(() => result.current.undo())
    expect(result.current.doc.count).toBe(0)
  })
})
