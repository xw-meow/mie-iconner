import { describe, expect, it } from 'vitest'

import type { IconItem } from '@/types/api'

import {
  CANVAS_SIZE,
  buildLayerFilter,
  createEmptyDocument,
  createLayer,
  defaultEffects,
  duplicateLayer,
  fitContain,
  motionGhosts,
  parseDraggedSticker,
  shiftLayer,
  type DesignDocument,
} from '@/features/design/model'

const icon: IconItem = {
  path: '/tmp/sticker.png',
  name: '测试贴纸',
  source: 'bundled',
  modified: 1,
}

describe('design model', () => {
  it('fits images into the layer box without distortion', () => {
    expect(fitContain(600, 300, 420, 420)).toEqual({
      width: 420,
      height: 210,
    })
    expect(fitContain(300, 600, 420, 420)).toEqual({
      width: 210,
      height: 420,
    })
  })

  it('builds composable filter chains', () => {
    const effect = { ...defaultEffects(), grayscale: true, blur: 4 }
    expect(buildLayerFilter(effect)).toBe('grayscale(1) blur(4px)')
    const outlined = buildLayerFilter({
      ...effect,
      outline: true,
      outlineWidth: 10,
      outlineColor: '#FF5C38',
    })
    expect(outlined).toContain('drop-shadow')
    expect(outlined.match(/drop-shadow/g)).toHaveLength(12)
  })

  it('creates three motion ghosts ordered far to near', () => {
    const ghosts = motionGhosts({
      ...defaultEffects(),
      motion: true,
      motionStrength: 60,
      motionAngle: 0,
    })
    expect(ghosts).toHaveLength(3)
    expect(ghosts[0].x).toBe(60)
    expect(ghosts[2].x).toBe(20)
    expect(ghosts[2].opacity).toBeGreaterThan(ghosts[0].opacity)
  })

  it('moves layers through the stack and duplicates with an offset', () => {
    const base = createEmptyDocument()
    const first = createLayer(icon, 'data:image/png;base64,aa', 'a', {
      x: 100,
      y: 100,
    })
    const second = createLayer(icon, 'data:image/png;base64,bb', 'b')
    const doc: DesignDocument = { ...base, layers: [first, second] }

    expect(shiftLayer(doc, 'a', 1).layers.map((layer) => layer.id)).toEqual([
      'b',
      'a',
    ])
    expect(shiftLayer(doc, 'a', -1)).toBe(doc)

    const duplicated = duplicateLayer(doc, 'a', 'c')
    expect(duplicated.layers.map((layer) => layer.id)).toEqual(['a', 'c', 'b'])
    expect(duplicated.layers[1].name).toBe('测试贴纸 副本')
    expect(duplicated.layers[1].x).toBe(136)
    expect(duplicated.layers[1].y).toBe(136)
  })

  it('parses valid drag payloads and rejects malformed ones', () => {
    expect(parseDraggedSticker(JSON.stringify(icon))).toEqual(icon)
    expect(parseDraggedSticker('{"path":1}')).toBeNull()
    expect(parseDraggedSticker('not json')).toBeNull()
  })

  it('uses a centered initial canvas position', () => {
    const layer = createLayer(icon, 'data:image/png;base64,aa', 'a')
    expect(layer.x).toBe(CANVAS_SIZE / 2)
    expect(layer.y).toBe(CANVAS_SIZE / 2)
  })
})
