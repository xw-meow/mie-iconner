import { describe, expect, it } from 'vitest'

import {
  colorToHsva,
  colorsEqual,
  formatColor,
  formatHex,
  hsvToRgb,
  isTransparentColor,
  parseColor,
  rgbToHsv,
} from '@/features/design/color'

describe('design colors', () => {
  it('parses hex, rgba and transparent', () => {
    expect(parseColor('#FF5C38')).toEqual({ r: 255, g: 92, b: 56, a: 1 })
    expect(parseColor('#f53')).toEqual({ r: 255, g: 85, b: 51, a: 1 })
    expect(parseColor('#FF5C3880')).toEqual({ r: 255, g: 92, b: 56, a: 128 / 255 })
    expect(parseColor('rgba(255, 92, 56, 0.4)')).toEqual({
      r: 255,
      g: 92,
      b: 56,
      a: 0.4,
    })
    expect(parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 })
  })

  it('formats alpha colors and keeps rgb at zero alpha', () => {
    expect(formatColor({ r: 255, g: 92, b: 56 }, 1)).toBe('#FF5C38')
    expect(formatColor({ r: 255, g: 92, b: 56 }, 0.5)).toBe(
      'rgba(255, 92, 56, 0.5)',
    )
    expect(formatColor({ r: 80, g: 141, b: 103 }, 0)).toBe(
      'rgba(80, 141, 103, 0)',
    )
  })

  it('treats any fully transparent color as equal', () => {
    expect(colorsEqual('transparent', 'rgba(80, 141, 103, 0)')).toBe(true)
    expect(colorsEqual('#FFF9EF', '#fff9ef')).toBe(true)
    expect(colorsEqual('#FFF9EF', '#FFFFFF')).toBe(false)
    expect(isTransparentColor('rgba(0, 0, 0, 0)')).toBe(true)
    expect(isTransparentColor('#000000')).toBe(false)
  })

  it('round-trips hsv through rgb', () => {
    const rgb = hsvToRgb(143, 0.43, 0.55)
    const hsv = rgbToHsv(rgb)
    expect(formatHex(rgb)).toBe('#508C67')
    expect(hsv.h).toBeCloseTo(143, 0)
    expect(hsv.s).toBeCloseTo(0.43, 1)
    expect(hsv.v).toBeCloseTo(0.55, 1)
  })

  it('uses the fallback hue only for the transparent sentinel', () => {
    expect(colorToHsva('transparent').a).toBe(0)
    expect(colorToHsva('transparent').h).toBeCloseTo(
      colorToHsva('#FFF9EF').h,
      0,
    )
    const preserved = colorToHsva('rgba(80, 141, 103, 0)')
    expect(preserved.a).toBe(0)
    expect(preserved.h).toBeCloseTo(143, 0)
  })
})
