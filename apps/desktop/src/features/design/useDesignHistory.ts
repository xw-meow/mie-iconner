import { useCallback, useRef, useState } from 'react'

const HISTORY_LIMIT = 60
/** 连续拖动/滑杆的合并窗口：同一动作 700ms 内只压一个撤销点 */
const COALESCE_MS = 700

interface HistoryState<T> {
  past: T[]
  present: T
  future: T[]
}

/**
 * 轻量撤销栈：
 * - `coalesceKey` 相同的连续修改会合并，拖拽不会产生几百个撤销点；
 * - 新增/删除图层不传 key，永远独立入栈；
 * - 历史里保存的是不可变文档，data URL 只复制引用。
 */
export function useDesignHistory<T>(initial: T) {
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initial,
    future: [],
  })
  const keyRef = useRef<string | null>(null)
  const timeRef = useRef(0)

  const update = useCallback(
    (updater: (current: T) => T, coalesceKey?: string) => {
      const now = performance.now()
      const coalesce =
        coalesceKey !== undefined &&
        keyRef.current === coalesceKey &&
        now - timeRef.current < COALESCE_MS
      keyRef.current = coalesceKey ?? null
      timeRef.current = now

      setState((previous) => {
        const next = updater(previous.present)
        if (Object.is(next, previous.present)) return previous
        return {
          past: coalesce
            ? previous.past
            : [...previous.past.slice(-(HISTORY_LIMIT - 1)), previous.present],
          present: next,
          future: [],
        }
      })
    },
    [],
  )

  const undo = useCallback(() => {
    keyRef.current = null
    setState((previous) => {
      if (previous.past.length === 0) return previous
      const present = previous.past[previous.past.length - 1]
      return {
        past: previous.past.slice(0, -1),
        present,
        future: [previous.present, ...previous.future].slice(0, HISTORY_LIMIT),
      }
    })
  }, [])

  const redo = useCallback(() => {
    keyRef.current = null
    setState((previous) => {
      if (previous.future.length === 0) return previous
      const [present, ...future] = previous.future
      return {
        past: [...previous.past.slice(-(HISTORY_LIMIT - 1)), previous.present],
        present,
        future,
      }
    })
  }, [])

  return {
    doc: state.present,
    update,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
