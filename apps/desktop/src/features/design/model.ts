import type { IconItem } from '@/types/api'

/** 设计稿固定 1024×1024，与 macOS 图标资源的最大尺寸一致。 */
export const CANVAS_SIZE = 1024
/** 单张贴纸在设计稿里的基准占位，缩放以这个边长为 100%。 */
export const LAYER_BASE_SIZE = 420
export const MIN_LAYER_SCALE = 0.15
export const MAX_LAYER_SCALE = 2.5

/** 从素材抽屉拖到画布的 dataTransfer MIME */
export const DESIGN_DRAG_MIME = 'application/x-mie-sticker'
export const DEFAULT_BACKGROUND = '#FFF9EF'

export interface LayerEffects {
  outline: boolean
  outlineColor: string
  outlineWidth: number
  motion: boolean
  motionStrength: number
  motionAngle: number
  grayscale: boolean
  blur: number
}

export interface DesignLayer {
  id: string
  icon: IconItem
  /** Rust 转码后的 PNG data URL，画布与导出共用 */
  src: string
  name: string
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  visible: boolean
  effects: LayerEffects
}

export interface DesignDocument {
  background: string
  /** 从底到顶，最后一项盖在最上面 */
  layers: DesignLayer[]
}

export const BACKGROUND_PRESETS = [
  '#FFF9EF',
  '#FFFFFF',
  '#F7E6CE',
  '#FFD9C7',
  '#FFE8A3',
  '#D9EFE2',
  '#D9E8F7',
  '#E8DDF6',
  '#2C2620',
]

export const OUTLINE_COLORS = [
  '#FFFFFF',
  '#2C2620',
  '#FF5C38',
  '#F3B33D',
  '#4A9D74',
  '#4E7FCC',
]

export const defaultEffects = (): LayerEffects => ({
  outline: false,
  outlineColor: '#FFFFFF',
  outlineWidth: 10,
  motion: false,
  motionStrength: 44,
  motionAngle: 0,
  grayscale: false,
  blur: 0,
})

export const createEmptyDocument = (): DesignDocument => ({
  background: DEFAULT_BACKGROUND,
  layers: [],
})

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export function createLayer(
  icon: IconItem,
  src: string,
  id: string,
  position?: { x: number; y: number },
): DesignLayer {
  return {
    id,
    icon,
    src,
    name: icon.name,
    x: position?.x ?? CANVAS_SIZE / 2,
    y: position?.y ?? CANVAS_SIZE / 2,
    scale: 1,
    rotation: 0,
    opacity: 1,
    visible: true,
    effects: defaultEffects(),
  }
}

export function updateLayer(
  doc: DesignDocument,
  id: string,
  patch: Partial<DesignLayer>,
): DesignDocument {
  return {
    ...doc,
    layers: doc.layers.map((layer) =>
      layer.id === id ? { ...layer, ...patch } : layer,
    ),
  }
}

export function updateEffects(
  doc: DesignDocument,
  id: string,
  patch: Partial<LayerEffects>,
): DesignDocument {
  return {
    ...doc,
    layers: doc.layers.map((layer) =>
      layer.id === id
        ? { ...layer, effects: { ...layer.effects, ...patch } }
        : layer,
    ),
  }
}

/** direction: 1 上移一层（更靠前），-1 下移一层。 */
export function shiftLayer(
  doc: DesignDocument,
  id: string,
  direction: 1 | -1,
): DesignDocument {
  const index = doc.layers.findIndex((layer) => layer.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= doc.layers.length) return doc
  const layers = [...doc.layers]
  const [layer] = layers.splice(index, 1)
  layers.splice(target, 0, layer)
  return { ...doc, layers }
}

export function duplicateLayer(
  doc: DesignDocument,
  id: string,
  nextId: string,
): DesignDocument {
  const index = doc.layers.findIndex((layer) => layer.id === id)
  if (index < 0) return doc
  const source = doc.layers[index]
  const copy: DesignLayer = {
    ...source,
    id: nextId,
    name: source.name.endsWith(' 副本')
      ? source.name
      : `${source.name} 副本`,
    x: clamp(source.x + 36, 40, CANVAS_SIZE - 40),
    y: clamp(source.y + 36, 40, CANVAS_SIZE - 40),
    effects: { ...source.effects },
  }
  const layers = [...doc.layers]
  layers.splice(index + 1, 0, copy)
  return { ...doc, layers }
}

export function fitContain(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 }
  const ratio = Math.min(maxWidth / width, maxHeight / height)
  return { width: width * ratio, height: height * ratio }
}

/** 描边用多方向 drop-shadow 模拟；半径按设计稿像素计算。 */
export function buildLayerFilter(effects: LayerEffects): string {
  const parts: string[] = []
  if (effects.grayscale) parts.push('grayscale(1)')
  if (effects.blur > 0) parts.push(`blur(${effects.blur}px)`)
  if (effects.outline && effects.outlineWidth > 0) {
    const radius = effects.outlineWidth
    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      parts.push(
        `drop-shadow(${x.toFixed(2)}px ${y.toFixed(2)}px 0 ${effects.outlineColor})`,
      )
    }
  }
  return parts.length > 0 ? parts.join(' ') : 'none'
}

export interface GhostOffset {
  x: number
  y: number
  /** 相对主图的不透明度 */
  opacity: number
}

/** 动感拖影固定 3 层；预览与导出共用同一组参数。 */
export function motionGhosts(effects: LayerEffects): GhostOffset[] {
  if (!effects.motion || effects.motionStrength <= 0) return []
  const angle = (effects.motionAngle * Math.PI) / 180
  return [3, 2, 1].map((step, index) => {
    const distance = (effects.motionStrength * step) / 3
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      opacity: 0.07 + index * 0.065,
    }
  })
}

export function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  return (
    element?.closest('input, textarea, select, [contenteditable="true"]') != null
  )
}

export function parseDraggedSticker(raw: string): IconItem | null {
  try {
    const value = JSON.parse(raw) as Partial<IconItem>
    if (
      typeof value.path !== 'string' ||
      typeof value.name !== 'string' ||
      typeof value.modified !== 'number' ||
      (value.source !== 'bundled' && value.source !== 'custom')
    ) {
      return null
    }
    return {
      path: value.path,
      name: value.name,
      source: value.source,
      modified: value.modified,
    }
  } catch {
    return null
  }
}
