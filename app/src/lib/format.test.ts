import { describe, expect, it } from 'vitest'

import {
  buildBreadcrumbs,
  displayPath,
  pathName,
  safeHexColor,
} from '@/lib/format'

describe('buildBreadcrumbs', () => {
  const home = '/Users/me'

  it('turns home into a single 个人 crumb', () => {
    expect(buildBreadcrumbs(home, home)).toEqual([
      { label: '个人', path: home, kind: 'home' },
    ])
  })

  it('builds nested home crumbs', () => {
    const crumbs = buildBreadcrumbs('/Users/me/Desktop/工作', home)
    expect(crumbs.map((crumb) => crumb.label)).toEqual([
      '个人',
      'Desktop',
      '工作',
    ])
    expect(crumbs.at(-1)?.path).toBe('/Users/me/Desktop/工作')
  })

  it('builds crumbs outside home from root', () => {
    const crumbs = buildBreadcrumbs('/usr/local/bin', home)
    expect(crumbs.map((crumb) => crumb.label)).toEqual([
      '/',
      'usr',
      'local',
      'bin',
    ])
    expect(crumbs[1].path).toBe('/usr')
  })

  it('returns empty for empty path', () => {
    expect(buildBreadcrumbs('', home)).toEqual([])
  })
})

describe('displayPath', () => {
  it('shortens home to tilde', () => {
    expect(displayPath('/Users/me', '/Users/me')).toBe('~')
    expect(displayPath('/Users/me/Desktop', '/Users/me')).toBe('~/Desktop')
  })

  it('keeps paths outside home unchanged', () => {
    expect(displayPath('/usr/local', '/Users/me')).toBe('/usr/local')
  })
})

describe('pathName', () => {
  it('handles root and normal paths', () => {
    expect(pathName('/')).toBe('/')
    expect(pathName('/Users/me/Desktop')).toBe('Desktop')
  })
})

describe('safeHexColor', () => {
  it('accepts valid hex colors', () => {
    expect(safeHexColor('#ff4d4f')).toBe('#ff4d4f')
    expect(safeHexColor('0f0')).toBe('#0f0')
  })

  it('falls back for invalid values', () => {
    expect(safeHexColor('red')).toBe('#0958d9')
    expect(safeHexColor(null)).toBe('#0958d9')
    expect(safeHexColor('#12345')).toBe('#0958d9')
  })
})
