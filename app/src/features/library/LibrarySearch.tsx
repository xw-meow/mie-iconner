import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

import { Keycap } from '@/components/ui/Keycap'
import { APP_EVENT, appEvents } from '@/lib/events'
import { cn } from '@/lib/cn'

interface LibrarySearchProps {
  value: string
  onChange: (value: string) => void
}

export function LibrarySearch({ value, onChange }: LibrarySearchProps) {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const focus = () => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    appEvents.addEventListener(APP_EVENT.focusSearch, focus)
    return () => appEvents.removeEventListener(APP_EVENT.focusSearch, focus)
  }, [])

  return (
    <div
      className={cn(
        'flex h-8 items-center gap-1.5 rounded-full border bg-white px-2.5 transition-all duration-150',
        focused
          ? 'border-brand/55 shadow-[0_0_0_3px_rgb(255_92_56_/_0.09)]'
          : 'border-line hover:border-line-strong',
      )}
    >
      <Search
        className={cn(
          'size-3.5 shrink-0 transition-colors',
          focused ? 'text-brand' : 'text-ink-3',
        )}
        strokeWidth={2}
      />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            if (value) onChange('')
            else inputRef.current?.blur()
          }
        }}
        placeholder="搜索贴纸名称"
        aria-label="搜索贴纸"
        className="min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-3"
        spellCheck={false}
      />
      {value ? (
        <button
          type="button"
          aria-label="清除搜索"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
          className="flex size-4 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-hover hover:text-ink"
        >
          <X className="size-3" strokeWidth={2.2} />
        </button>
      ) : (
        <Keycap className="opacity-80">⌘F</Keycap>
      )}
    </div>
  )
}
