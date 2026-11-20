import { useRef, useState } from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/cn'
import { DEFAULT_BACKGROUND } from '@/features/design/model'
import {
  colorToHsva,
  formatColor,
  formatHex,
  hsvToRgb,
  parseColor,
  rgbToHsv,
} from '@/features/design/color'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  onClose: () => void
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const HUE_TRACK =
  'linear-gradient(to right, #FF4D4D 0%, #FFD84D 17%, #6EDB6E 33%, #4DD8D8 50%, #4D9BFF 67%, #B06CFF 83%, #FF4D4D 100%)'

/**
 * 主题化取色纸：饱和/明度画布 + 色相 + 透明度。
 * 不调用系统取色盘，输入输出都走应用自己的颜色格式。
 */
export function ColorPicker({ value, onChange, onClose }: ColorPickerProps) {
  const initial = colorToHsva(value, DEFAULT_BACKGROUND)
  const [hsv, setHsv] = useState({
    h: initial.h,
    s: initial.s,
    v: initial.v,
  })
  const [alpha, setAlpha] = useState(initial.a)
  const [hexInput, setHexInput] = useState(
    formatHex(hsvToRgb(initial.h, initial.s, initial.v)).slice(1),
  )
  const svRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v)
  const alphaPercent = Math.round(alpha * 100)
  const solid = `rgb(${rgb.r} ${rgb.g} ${rgb.b})`
  const transparent = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`

  const emit = (
    next: { h: number; s: number; v: number },
    nextAlpha: number,
    keepHex = false,
  ) => {
    const nextRgb = hsvToRgb(next.h, next.s, next.v)
    onChange(formatColor(nextRgb, nextAlpha))
    if (!keepHex) setHexInput(formatHex(nextRgb).slice(1))
  }

  const applySv = (clientX: number, clientY: number) => {
    const node = svRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const s = clamp((clientX - rect.left) / rect.width, 0, 1)
    const v = 1 - clamp((clientY - rect.top) / rect.height, 0, 1)
    const next = { ...hsv, s, v }
    setHsv(next)
    emit(next, alpha)
  }

  const handleHex = (raw: string) => {
    const next = raw.replace(/[^0-9a-f]/gi, '').slice(0, 6)
    setHexInput(next)
    if (next.length !== 3 && next.length !== 6) return
    const parsed = parseColor(`#${next}`)
    if (!parsed) return
    const nextHsv = rgbToHsv(parsed)
    setHsv({ h: nextHsv.h, s: nextHsv.s, v: nextHsv.v })
    onChange(formatColor(parsed, alpha))
  }

  const handleHexBlur = () => {
    setHexInput(formatHex(rgb).slice(1))
  }

  return (
    <div
      data-design-color-picker
      className="mt-2 rounded-[12px] border border-line bg-[#fffdfa] p-2.5 shadow-[0_12px_28px_-24px_rgb(80_58_34_/_0.55)]"
    >
      <div className="flex items-center justify-between pb-2">
        <span className="font-rounded text-[10.5px] font-semibold tracking-[0.02em] text-ink-2">
          调色纸
        </span>
        <button
          type="button"
          aria-label="关闭调色纸"
          onClick={onClose}
          className="flex size-5 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-hover hover:text-ink"
        >
          <X className="size-3" strokeWidth={2.2} />
        </button>
      </div>

      <div
        ref={svRef}
        role="group"
        aria-label="饱和度和明度，点击或拖动取色"
        tabIndex={0}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          dragging.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
          applySv(event.clientX, event.clientY)
        }}
        onPointerMove={(event) => {
          if (!dragging.current) return
          applySv(event.clientX, event.clientY)
        }}
        onPointerUp={(event) => {
          dragging.current = false
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        onPointerCancel={() => {
          dragging.current = false
        }}
        onKeyDown={(event) => {
          if (!event.key.startsWith('Arrow')) return
          event.preventDefault()
          const step = event.shiftKey ? 0.1 : 0.02
          const next = { ...hsv }
          if (event.key === 'ArrowLeft') next.s = clamp(next.s - step, 0, 1)
          if (event.key === 'ArrowRight') next.s = clamp(next.s + step, 0, 1)
          if (event.key === 'ArrowUp') next.v = clamp(next.v + step, 0, 1)
          if (event.key === 'ArrowDown') next.v = clamp(next.v - step, 0, 1)
          setHsv(next)
          emit(next, alpha)
        }}
        className="relative h-[112px] w-full cursor-crosshair overflow-hidden rounded-[9px] outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-brand/40"
        style={{ backgroundColor: `hsl(${hsv.h} 88% 55%)` }}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black to-transparent" />
        <span
          className="pointer-events-none absolute size-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(44_38_32_/_0.28),0_2px_6px_rgb(44_38_32_/_0.28)]"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            backgroundColor: solid,
          }}
        />
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <span className="w-11 shrink-0 text-[9.5px] text-ink-3">色相</span>
        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={Math.round(hsv.h)}
          aria-label="色相"
          onChange={(event) => {
            const next = { ...hsv, h: Number(event.target.value) }
            setHsv(next)
            emit(next, alpha)
          }}
          className="color-range min-w-0 flex-1"
          style={{ background: HUE_TRACK }}
        />
        <span className="w-7 shrink-0 text-right text-[9.5px] tabular-nums text-ink-3">
          {Math.round(hsv.h)}°
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="w-11 shrink-0 whitespace-nowrap text-[9.5px] text-ink-3">不透明度</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={alphaPercent}
          aria-label="背景不透明度"
          onChange={(event) => {
            const next = Number(event.target.value) / 100
            setAlpha(next)
            emit(hsv, next)
          }}
          className="alpha-range color-range min-w-0 flex-1"
          style={
            {
              '--alpha-gradient': `linear-gradient(to right, ${transparent}, ${solid})`,
            } as React.CSSProperties
          }
        />
        <span className="w-7 shrink-0 text-right text-[9.5px] tabular-nums text-ink-3">
          {alphaPercent}%
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <label className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-[8px] border border-line bg-white px-2 transition-colors focus-within:border-brand/55">
          <span className="text-[10px] text-ink-3">#</span>
          <input
            value={hexInput}
            onChange={(event) => handleHex(event.target.value)}
            onBlur={handleHexBlur}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
            maxLength={6}
            aria-label="背景色 HEX"
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent font-mono text-[10.5px] uppercase tracking-[0.03em] text-ink outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setAlpha(0)
            emit(hsv, 0)
          }}
          className={cn(
            'flex h-7 shrink-0 items-center gap-1 rounded-[8px] border px-2 text-[10px] font-medium transition-colors',
            alpha === 0
              ? 'border-brand/45 bg-brand-tint text-brand'
              : 'border-line bg-white text-ink-2 hover:border-line-strong',
          )}
        >
          <span className="transparency-swatch size-3 rounded-full border border-line-strong/70" />
          全透明
        </button>
      </div>
    </div>
  )
}
