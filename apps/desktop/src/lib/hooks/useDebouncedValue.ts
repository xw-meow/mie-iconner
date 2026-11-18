import { useEffect, useState } from 'react'

/** 轻量防抖：地址栏每次击键都去扫目录，90ms 足够合并连续输入 */
export function useDebouncedValue<T>(value: T, delay = 90): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debounced
}
