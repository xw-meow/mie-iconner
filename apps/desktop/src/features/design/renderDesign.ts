import {
  CANVAS_SIZE,
  LAYER_BASE_SIZE,
  fitContain,
  motionGhosts,
  type DesignDocument,
  type LayerEffects,
} from '@/features/design/model'
import { isTransparentColor } from '@/features/design/color'

/** 特效（描边/拖影/模糊）可能超出贴纸基准框，留一圈安全边。 */
const EFFECT_PADDING = 160
const SURFACE_SIZE = LAYER_BASE_SIZE + EFFECT_PADDING * 2

const imageCache = new Map<string, Promise<HTMLImageElement>>()

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src)
  if (cached) return cached
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => {
      imageCache.delete(src)
      reject(new Error('贴纸图片加载失败'))
    }
    image.src = src
  })
  imageCache.set(src, promise)
  return promise
}

function rasterFilter(effects: LayerEffects): string {
  const parts: string[] = []
  if (effects.grayscale) parts.push('grayscale(1)')
  if (effects.blur > 0) parts.push(`blur(${effects.blur}px)`)
  return parts.length > 0 ? parts.join(' ') : 'none'
}

function drawSticker(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  effects: LayerEffects,
  offsetX = 0,
  offsetY = 0,
) {
  const fitted = fitContain(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height,
    LAYER_BASE_SIZE,
    LAYER_BASE_SIZE,
  )
  const x = (SURFACE_SIZE - fitted.width) / 2 + offsetX
  const y = (SURFACE_SIZE - fitted.height) / 2 + offsetY
  ctx.save()
  ctx.filter = rasterFilter(effects)
  ctx.drawImage(image, x, y, fitted.width, fitted.height)
  ctx.restore()
}

function makeSurface(): {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
} {
  const canvas = document.createElement('canvas')
  canvas.width = SURFACE_SIZE
  canvas.height = SURFACE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前环境不支持画布导出')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return { canvas, ctx }
}

/** 生成带滤镜和描边的单图层画布，坐标以贴纸基准框中心为原点。 */
function renderLayerSurface(
  image: HTMLImageElement,
  effects: LayerEffects,
): HTMLCanvasElement {
  const { canvas, ctx } = makeSurface()

  if (effects.outline && effects.outlineWidth > 0) {
    const mask = makeSurface()
    drawSticker(mask.ctx, image, effects)
    mask.ctx.globalCompositeOperation = 'source-in'
    mask.ctx.fillStyle = effects.outlineColor
    mask.ctx.fillRect(0, 0, SURFACE_SIZE, SURFACE_SIZE)

    const radius = effects.outlineWidth
    const steps = Math.max(16, Math.ceil(radius * 2.4))
    for (let index = 0; index < steps; index += 1) {
      const angle = (Math.PI * 2 * index) / steps
      ctx.drawImage(
        mask.canvas,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      )
    }
  }

  for (const ghost of motionGhosts(effects)) {
    ctx.globalAlpha = ghost.opacity
    drawSticker(ctx, image, effects, ghost.x, ghost.y)
  }
  ctx.globalAlpha = 1
  drawSticker(ctx, image, effects)

  return canvas
}

/**
 * 把设计稿按 1024×1024 重绘为 PNG data URL。
 * 图层顺序、旋转/缩放、滤镜、描边与动感拖影都走同一份参数，
 * 保证画布预览与最终写进 Finder 的图标一致。
 */
export async function renderDesign(doc: DesignDocument): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_SIZE
  canvas.height = CANVAS_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前环境不支持画布导出')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  if (!isTransparentColor(doc.background)) {
    ctx.fillStyle = doc.background
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  }

  const visible = doc.layers.filter((layer) => layer.visible)
  const images = await Promise.all(visible.map((layer) => loadImage(layer.src)))

  visible.forEach((layer, index) => {
    const surface = renderLayerSurface(images[index], layer.effects)
    ctx.save()
    ctx.globalAlpha = layer.opacity
    ctx.translate(layer.x, layer.y)
    ctx.rotate((layer.rotation * Math.PI) / 180)
    ctx.scale(layer.scale, layer.scale)
    ctx.drawImage(surface, -SURFACE_SIZE / 2, -SURFACE_SIZE / 2)
    ctx.restore()
  })

  return canvas.toDataURL('image/png')
}
