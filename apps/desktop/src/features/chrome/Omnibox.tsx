import { useCallback, useEffect, useRef, useState } from 'react'
import { useCombobox } from 'downshift'
import { AlertCircle, CornerDownLeft, Folder, X } from 'lucide-react'

import { FolderMark } from '@/components/ui/FolderGlyph'
import { Keycap } from '@/components/ui/Keycap'
import { useEnvQuery, useSuggestionsQuery } from '@/features/queries'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { errorText } from '@/lib/errors'
import { APP_EVENT, appEvents } from '@/lib/events'
import { displayPath } from '@/lib/format'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { notifyError } from '@/lib/toast'
import { useBrowserStore } from '@/stores/browser'
import type { PathSuggestion } from '@/types/api'

/**
 * 地址栏 omnibox：
 * - Chrome 式路径补全（前缀优先、再包含），下拉里直接回车进入；
 * - 聚焦全选，失焦恢复为当前路径；
 * - 无效路径红环 + 抖动，不改变当前目录。
 */
export function Omnibox() {
  const path = useBrowserStore((state) => state.path)
  const setPath = useBrowserStore((state) => state.setPath)
  const { data: env } = useEnvQuery()

  const currentDisplay = env ? displayPath(path, env.home) : path

  const [value, setValue] = useState(currentDisplay)
  const [focused, setFocused] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [attempted, setAttempted] = useState('')
  const [shaking, setShaking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const shakeTimer = useRef<number | null>(null)

  // 用回调 ref 赋值，避免把 ref 对象直接交给第三方 prop-getter
  const assignInputRef = useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node
  }, [])

  useEffect(() => {
    return () => {
      if (shakeTimer.current) window.clearTimeout(shakeTimer.current)
    }
  }, [])

  // 未聚焦时直接展示当前路径，避免用 effect 把 store 同步回本地 state
  const inputValue = focused ? value : currentDisplay

  const debounced = useDebouncedValue(inputValue.trim(), 90)
  const suggestionsQuery = useSuggestionsQuery(debounced, focused)
  const suggestions = suggestionsQuery.data ?? []

  const closeMenuRef = useRef<(() => void) | null>(null)

  const navigate = useCallback(
    async (input: string) => {
      const trimmed = input.trim()
      if (!trimmed) return
      try {
        const resolved = await api.resolvePath(trimmed)
        if (!resolved) {
          setInvalid(true)
          setAttempted(trimmed)
          setShaking(false)
          if (shakeTimer.current) window.clearTimeout(shakeTimer.current)
          window.requestAnimationFrame(() => setShaking(true))
          shakeTimer.current = window.setTimeout(() => setShaking(false), 460)
          return
        }
        setInvalid(false)
        setAttempted('')
        setValue(resolved.display)
        setPath(resolved.path)
        closeMenuRef.current?.()
        inputRef.current?.blur()
      } catch (error) {
        notifyError('无法打开路径', errorText(error))
      }
    },
    [setPath],
  )

  const {
    getInputProps,
    getMenuProps,
    getItemProps,
    highlightedIndex,
    isOpen,
    openMenu,
    closeMenu,
  } = useCombobox<PathSuggestion>({
    items: suggestions,
    inputValue,
    itemToString: (item) => item?.display ?? '',
    onInputValueChange: ({ inputValue, type }) => {
      if (type === useCombobox.stateChangeTypes.InputChange) {
        setValue(inputValue ?? '')
        setInvalid(false)
      }
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem) void navigate(selectedItem.path)
    },
    stateReducer: (_state, { type, changes }) => {
      // 鼠标点击输入框时，focus 已经先一步 openMenu；
      // Downshift 默认把紧随其后的 click 当成“再次点击”取反，把刚打开的下拉关掉。
      // 这里让点击只负责打开，避免“弹出一下又消失”。
      if (type === useCombobox.stateChangeTypes.InputClick) {
        return { ...changes, isOpen: true }
      }
      return changes
    },
  })

  useEffect(() => {
    closeMenuRef.current = closeMenu
  }, [closeMenu])

  // Downshift 要求每次渲染都调用 getMenuProps，即使菜单没显示；
  // 提前取好，渲染时再挂到元素上。
  const menuProps = getMenuProps({
    onMouseDown: (event) => event.preventDefault(),
  })

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true)
    setInvalid(false)
    setValue(currentDisplay)
    event.currentTarget.select()
    openMenu()
  }

  const handleBlur = () => {
    setFocused(false)
    setInvalid(false)
    setValue(currentDisplay)
    closeMenu()
  }

  const handleClear = () => {
    inputRef.current?.focus()
    setValue('')
    setInvalid(false)
    openMenu()
  }

  const handleKeyDownCapture = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if ((event.target as HTMLElement)?.tagName !== 'INPUT') return
    if (event.key === 'Enter') {
      // Downshift 用 -1 表示没有高亮项；不能只判 null/undefined
      const target =
        typeof highlightedIndex === 'number' && highlightedIndex >= 0
          ? suggestions[highlightedIndex]?.path
          : value
      if (!target?.trim()) return
      event.preventDefault()
      event.stopPropagation()
      void navigate(target)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (isOpen) {
        closeMenu()
        setValue(currentDisplay)
        setInvalid(false)
      } else {
        inputRef.current?.blur()
      }
    }
  }

  useEffect(() => {
    const focus = () => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    appEvents.addEventListener(APP_EVENT.focusOmnibox, focus)
    return () => appEvents.removeEventListener(APP_EVENT.focusOmnibox, focus)
  }, [])

  const menuVisible = focused && isOpen
  const selectedIndex =
    typeof highlightedIndex === 'number' ? highlightedIndex : -1

  return (
    <div className="relative min-w-0 flex-1">
      <div
        className={cn(
          'flex h-9 items-center gap-2 rounded-full border bg-white px-3 transition-[border-color,box-shadow] duration-150',
          focused
            ? 'border-brand/60 shadow-[0_0_0_3px_rgb(255_92_56_/_0.10)]'
            : 'border-line shadow-[0_1px_2px_rgb(80_58_34_/_0.04)] hover:border-line-strong',
          invalid && 'border-danger/60 shadow-[0_0_0_3px_rgb(217_56_30_/_0.10)]',
          shaking && 'shake',
        )}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault()
            inputRef.current?.focus()
          }
        }}
        onKeyDownCapture={handleKeyDownCapture}
      >
        <FolderMark
          className={cn(
            'size-[15px] shrink-0 transition-colors',
            focused ? 'text-brand' : 'text-ink-3',
          )}
        />
        <input
          {...getInputProps({
            ref: assignInputRef,
            onFocus: handleFocus,
            onBlur: handleBlur,
            placeholder: '输入路径，回车直达',
            spellCheck: false,
            autoComplete: 'off',
            'aria-label': '当前路径',
            'aria-invalid': invalid,
            className:
              'min-w-0 flex-1 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-3',
          })}
        />
        {inputValue ? (
          <button
            type="button"
            aria-label="清除输入"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleClear}
            className="flex size-4 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-hover hover:text-ink"
          >
            <X className="size-3" strokeWidth={2.2} />
          </button>
        ) : focused ? (
          <Keycap>esc</Keycap>
        ) : (
          <Keycap className="opacity-90">⌘L</Keycap>
        )}
      </div>

      <div
        {...menuProps}
        role="listbox"
        aria-label="路径建议"
        className={cn(
          'absolute inset-x-0 top-[42px] z-[60] overflow-hidden rounded-[14px] border border-line bg-surface-raised shadow-panel-strong',
          menuVisible ? 'animate-pop-in' : 'hidden',
        )}
      >
        <div className="scroll-area max-h-[286px] overflow-y-auto p-1.5">
          {invalid ? (
            <div className="flex items-center gap-2 rounded-lg bg-danger-soft px-2.5 py-2 text-[11.5px] text-danger">
              <AlertCircle className="size-3.5 shrink-0" />
              <span className="min-w-0 truncate">
                找不到「{attempted}」，检查一下路径
              </span>
            </div>
          ) : null}

          {suggestions.map((suggestion, index) => {
            const active = index === selectedIndex
            return (
              <div
                {...getItemProps({ item: suggestion, index })}
                key={suggestion.path}
                className={cn(
                  'flex h-9 cursor-default items-center gap-2 rounded-lg px-2.5 transition-colors',
                  active ? 'bg-brand-tint text-ink' : 'text-ink-2',
                )}
              >
                <Folder
                  className={cn(
                    'size-3.5 shrink-0',
                    active ? 'text-brand' : 'text-ink-3',
                  )}
                  strokeWidth={1.9}
                />
                <span className="min-w-0 shrink truncate text-[12.5px] font-medium text-ink">
                  {suggestion.name}
                </span>
                <span className="ml-auto min-w-0 truncate pl-3 text-[10.5px] text-ink-3">
                  {suggestion.display}
                </span>
              </div>
            )
          })}

          {suggestions.length === 0 ? (
            <div className="flex items-center gap-2 px-2.5 py-2.5 text-[11.5px] text-ink-3">
              {suggestionsQuery.isFetching ? (
                '正在查找…'
              ) : suggestionsQuery.isError ? (
                <span className="text-danger">
                  无法读取路径建议：{errorText(suggestionsQuery.error)}
                </span>
              ) : (
                <>
                  <CornerDownLeft className="size-3.5" />
                  按回车进入该路径
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 border-t border-line/70 px-3 py-1.5 text-[10px] text-ink-3">
          <span className="flex items-center gap-1">
            <Keycap>↑</Keycap>
            <Keycap>↓</Keycap>
            选择
          </span>
          <span className="flex items-center gap-1">
            <Keycap>↩</Keycap>
            进入
          </span>
          <span className="flex items-center gap-1">
            <Keycap>esc</Keycap>
            关闭
          </span>
        </div>
      </div>
    </div>
  )
}
