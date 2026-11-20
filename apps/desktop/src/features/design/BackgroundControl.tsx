import { useEffect, useId, useRef, useState } from 'react'
import { Palette } from 'lucide-react'

import { ColorPicker } from '@/features/design/ColorPicker'
import { colorsEqual, isTransparentColor, TRANSPARENT } from '@/features/design/color'
import { BACKGROUND_PRESETS } from '@/features/design/model'
import { cn } from '@/lib/cn'

interface BackgroundControlProps {
  value: string
  onChange: (color: string) => void
}

/** 画布背景：预设、透明底和主题化取色纸。 */
export function BackgroundControl({ value, onChange }: BackgroundControlProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLElement>(null)
  const pickerId = useId()
  const transparent = isTransparentColor(value)
  const customActive =
    !transparent && !BACKGROUND_PRESETS.some((color) => colorsEqual(color, value))

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  return (
    <section
      ref={rootRef}
      className="border-b border-line/75 px-3.5 py-3.5"
    >
      <div className="flex items-center gap-1.5">
        <h2 className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.04em] text-ink-3">
          <Palette className="size-3" />
          画布背景
        </h2>
        {transparent ? (
          <span className="ml-auto rounded-full bg-hover px-2 py-0.5 text-[9.5px] text-ink-3">
            透明
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {BACKGROUND_PRESETS.map((color) => (
          <ColorSwatch
            key={color}
            color={color}
            label={`背景色 ${color}`}
            active={colorsEqual(value, color)}
            onClick={() => {
              onChange(color)
              setOpen(false)
            }}
          />
        ))}
        <button
          type="button"
          aria-label="透明背景"
          aria-pressed={transparent}
          title="透明背景"
          onClick={() => {
            onChange(TRANSPARENT)
            setOpen(false)
          }}
          className={cn(
            'transparency-swatch relative size-[18px] shrink-0 rounded-full border transition-transform duration-150 hover:scale-110',
            transparent
              ? 'border-brand ring-2 ring-brand/25 ring-offset-1'
              : 'border-line-strong/80',
          )}
        >
          <span className="absolute left-1/2 top-1/2 h-px w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-ink-3/65" />
        </button>
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={pickerId}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'mt-2 flex h-[26px] items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-medium transition-colors',
          open || customActive
            ? 'border-brand/35 bg-brand-tint text-brand'
            : 'border-line bg-white text-ink-2 hover:border-line-strong hover:text-ink',
        )}
      >
        <span
          className={cn(
            'size-3 rounded-full border border-line-strong/70',
            transparent && 'transparency-swatch',
          )}
          style={!transparent ? { backgroundColor: value } : undefined}
        />
        <Palette className="size-3" />
        自定义
      </button>

      {open ? (
        <div id={pickerId}>
          <ColorPicker
            value={value}
            onChange={onChange}
            onClose={() => setOpen(false)}
          />
        </div>
      ) : null}
    </section>
  )
}

function ColorSwatch({
  color,
  label,
  active,
  onClick,
}: {
  color: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        'size-[18px] shrink-0 rounded-full border transition-transform duration-150 hover:scale-110',
        active
          ? 'border-brand ring-2 ring-brand/25 ring-offset-1'
          : 'border-line-strong/80',
      )}
      style={{ backgroundColor: color }}
    />
  )
}
