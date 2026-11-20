export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Rgba extends Rgb {
  a: number
}

export interface Hsva {
  h: number
  s: number
  v: number
  a: number
}

export const TRANSPARENT = 'transparent'

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const clampByte = (value: number): number => clamp(Math.round(value), 0, 255)
const clampUnit = (value: number): number => clamp(value, 0, 1)

function parseHex(input: string): Rgba | null {
  const hex = input.slice(1)
  if (![3, 4, 6, 8].includes(hex.length) || !/^[0-9a-f]+$/i.test(hex)) {
    return null
  }
  const short = hex.length === 3 || hex.length === 4
  const step = short ? 1 : 2
  const channel = (index: number): number => {
    const raw = hex.slice(index * step, index * step + step)
    return parseInt(short ? raw + raw : raw, 16)
  }
  const count = hex.length === 4 || hex.length === 8 ? 4 : 3
  return {
    r: channel(0),
    g: channel(1),
    b: channel(2),
    a: count === 4 ? channel(3) / 255 : 1,
  }
}

function parseNumber(
  input: string,
  max: number,
): number {
  if (input.endsWith('%')) {
    return (parseFloat(input) / 100) * max
  }
  return parseFloat(input)
}

function parseRgbFunction(input: string): Rgba | null {
  const match = input.match(
    /^rgba?\(\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i,
  )
  if (!match) return null
  const [r, g, b] = [match[1], match[2], match[3]].map((part) =>
    clampByte(parseNumber(part, 255)),
  )
  const alpha = match[4]
    ? clampUnit(
        match[4].endsWith('%')
          ? parseFloat(match[4]) / 100
          : parseFloat(match[4]),
      )
    : 1
  if ([r, g, b, alpha].some((item) => Number.isNaN(item))) return null
  return { r, g, b, a: alpha }
}

/** 解析 UI 里可能出现的 hex / rgb(a) / transparent。 */
export function parseColor(value: string | null | undefined): Rgba | null {
  if (!value) return null
  const input = value.trim().toLowerCase()
  if (input === TRANSPARENT) return { r: 0, g: 0, b: 0, a: 0 }
  if (input.startsWith('#')) return parseHex(input)
  if (input.startsWith('rgb')) return parseRgbFunction(input)
  return null
}

export function formatHex(rgb: Rgb): string {
  const part = (value: number) =>
    clampByte(value).toString(16).padStart(2, '0').toUpperCase()
  return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`
}

/** 不透明时写 hex；有 alpha 时写 rgba；全透明统一成 transparent。 */
export function formatColor(rgb: Rgb, alpha: number): string {
  const a = clampUnit(alpha)
  const rounded = Math.round(a * 100) / 100
  // 0 透明度也保留底色，重新打开调色纸时不会丢掉色相
  if (a <= 0.001) {
    return `rgba(${clampByte(rgb.r)}, ${clampByte(rgb.g)}, ${clampByte(rgb.b)}, 0)`
  }
  if (a >= 0.999) return formatHex(rgb)
  return `rgba(${clampByte(rgb.r)}, ${clampByte(rgb.g)}, ${clampByte(rgb.b)}, ${rounded})`
}

export function isTransparentColor(value: string): boolean {
  return (parseColor(value)?.a ?? 1) <= 0.001
}

export function colorsEqual(
  first: string | null | undefined,
  second: string | null | undefined,
): boolean {
  if (first === second) return true
  const a = parseColor(first)
  const b = parseColor(second)
  if (!a || !b) return (first ?? '').toLowerCase() === (second ?? '').toLowerCase()
  // 全透明在视觉上等价，不要求底层 RGB 相同
  if (a.a <= 0.001 && b.a <= 0.001) return true
  return (
    a.r === b.r &&
    a.g === b.g &&
    a.b === b.b &&
    Math.abs(a.a - b.a) < 0.005
  )
}

/** 从背景值还原 HSV。透明背景借用 fallback 的色相，避免变成黑色。 */
export function colorToHsva(value: string, fallback = '#FFF9EF'): Hsva {
  const parsed = parseColor(value)
  const fallbackColor = parseColor(fallback) ?? { r: 255, g: 249, b: 239, a: 1 }
  if (!parsed) return { ...rgbToHsv(fallbackColor), a: 1 }
  if (parsed.a <= 0.001) {
    // 显式 transparent 没有可用色相，用 fallback；rgba(...,0) 保留自己的颜色
    const base = value.trim().toLowerCase() === TRANSPARENT ? fallbackColor : parsed
    return { ...rgbToHsv(base), a: 0 }
  }
  return { ...rgbToHsv(parsed), a: parsed.a }
}

export function rgbToHsv(rgb: Rgb): { h: number; s: number; v: number } {
  const r = clampUnit(rgb.r / 255)
  const g = clampUnit(rgb.g / 255)
  const b = clampUnit(rgb.b / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0

  if (delta > 0.0001) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }

  return {
    h,
    s: max === 0 ? 0 : delta / max,
    v: max,
  }
}

export function hsvToRgb(h: number, s: number, v: number): Rgb {
  const hue = ((h % 360) + 360) % 360
  const saturation = clampUnit(s)
  const value = clampUnit(v)
  const c = value * saturation
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = value - c
  let r = 0
  let g = 0
  let b = 0
  if (hue < 60) [r, g, b] = [c, x, 0]
  else if (hue < 120) [r, g, b] = [x, c, 0]
  else if (hue < 180) [r, g, b] = [0, c, x]
  else if (hue < 240) [r, g, b] = [0, x, c]
  else if (hue < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return {
    r: clampByte((r + m) * 255),
    g: clampByte((g + m) * 255),
    b: clampByte((b + m) * 255),
  }
}

