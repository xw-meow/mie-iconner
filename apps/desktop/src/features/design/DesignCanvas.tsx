import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, MousePointer2, Plus, Scan } from 'lucide-react'

import { cn } from '@/lib/cn'
import {
  CANVAS_SIZE,
  DESIGN_DRAG_MIME,
  LAYER_BASE_SIZE,
  MAX_LAYER_SCALE,
  MIN_LAYER_SCALE,
  buildLayerFilter,
  clamp,
  motionGhosts,
  parseDraggedSticker,
  type DesignDocument,
  type DesignLayer,
} from '@/features/design/model'
import type { IconItem } from '@/types/api'

const FIT_GUTTER = 36
const MIN_ZOOM = 0.15
const MAX_ZOOM = 2

interface DesignCanvasProps {
  doc: DesignDocument
  selectedId: string | null
  onSelect: (id: string | null) => void
  onLayerChange: (
    id: string,
    patch: Partial<DesignLayer>,
    key?: string,
  ) => void
  onDropSticker: (icon: IconItem, position: { x: number; y: number }) => void
}

interface DragState {
  mode: 'move' | 'resize'
  id: string
  startClientX: number
  startClientY: number
  originX: number
  originY: number
  initialScale: number
  distance: number
  rect: DOMRect
}

/** 中间画布：缩放/滚动、图层拖拽、素材投放和选中框都在这里。 */
export function DesignCanvas({
  doc,
  selectedId,
  onSelect,
  onLayerChange,
  onDropSticker,
}: DesignCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [zoomMode, setZoomMode] = useState<'fit' | 'manual'>('fit')
  const [manualScale, setManualScale] = useState(0.6)
  const [dropActive, setDropActive] = useState(false)

  useEffect(() => {
    const node = viewportRef.current
    if (!node) return
    const update = () => {
      setViewport({
        width: node.clientWidth,
        height: node.clientHeight,
      })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const fitScale = useMemo(() => {
    if (viewport.width === 0 || viewport.height === 0) return 0.42
    return clamp(
      Math.min(
        (viewport.width - FIT_GUTTER * 2) / CANVAS_SIZE,
        (viewport.height - FIT_GUTTER * 2) / CANVAS_SIZE,
      ),
      0.12,
      1,
    )
  }, [viewport])

  const scale = zoomMode === 'fit' ? fitScale : manualScale
  const selected =
    doc.layers.find((layer) => layer.id === selectedId) ?? null

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      if (drag.mode === 'move') {
        const dx =
          ((event.clientX - drag.startClientX) / drag.rect.width) * CANVAS_SIZE
        const dy =
          ((event.clientY - drag.startClientY) / drag.rect.height) * CANVAS_SIZE
        onLayerChange(
          drag.id,
          {
            x: clamp(drag.originX + dx, 0, CANVAS_SIZE),
            y: clamp(drag.originY + dy, 0, CANVAS_SIZE),
          },
          `move-${drag.id}`,
        )
      } else {
        const centerX =
          drag.rect.left + (drag.originX / CANVAS_SIZE) * drag.rect.width
        const centerY =
          drag.rect.top + (drag.originY / CANVAS_SIZE) * drag.rect.height
        const distance = Math.hypot(
          event.clientX - centerX,
          event.clientY - centerY,
        )
        const next = clamp(
          (drag.initialScale * distance) / Math.max(drag.distance, 1),
          MIN_LAYER_SCALE,
          MAX_LAYER_SCALE,
        )
        onLayerChange(drag.id, { scale: next }, `scale-${drag.id}`)
      }
    }
    const handleUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [onLayerChange])

  useEffect(
    () => () => {
      document.body.style.cursor = ''
    },
    [],
  )

  const beginMove = (
    event: React.PointerEvent<HTMLDivElement>,
    layer: DesignLayer,
  ) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    onSelect(layer.id)
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = {
      mode: 'move',
      id: layer.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: layer.x,
      originY: layer.y,
      initialScale: layer.scale,
      distance: 0,
      rect,
    }
    document.body.style.cursor = 'grabbing'
  }

  const beginResize = (
    event: React.PointerEvent<HTMLButtonElement>,
    layer: DesignLayer,
  ) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const centerX = rect.left + (layer.x / CANVAS_SIZE) * rect.width
    const centerY = rect.top + (layer.y / CANVAS_SIZE) * rect.height
    dragRef.current = {
      mode: 'resize',
      id: layer.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: layer.x,
      originY: layer.y,
      initialScale: layer.scale,
      distance: Math.max(
        Math.hypot(event.clientX - centerX, event.clientY - centerY),
        1,
      ),
      rect,
    }
    document.body.style.cursor = 'nwse-resize'
  }

  const zoomTo = (next: number) => {
    setZoomMode('manual')
    setManualScale(clamp(next, MIN_ZOOM, MAX_ZOOM))
  }

  const pointOnStage = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: clamp(((clientX - rect.left) / rect.width) * CANVAS_SIZE, 48, CANVAS_SIZE - 48),
      y: clamp(((clientY - rect.top) / rect.height) * CANVAS_SIZE, 48, CANVAS_SIZE - 48),
    }
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDropActive(false)
    const icon = parseDraggedSticker(
      event.dataTransfer.getData(DESIGN_DRAG_MIME),
    )
    const point = pointOnStage(event.clientX, event.clientY)
    if (icon && point) onDropSticker(icon, point)
  }

  const selectionScale = selected ? selected.scale * scale : scale
  const inverse = selectionScale > 0 ? 1 / selectionScale : 1
  const handleSize = clamp(11 * inverse, 8, 160)

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#efe7db]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgb(255_253_248_/_0.65),transparent_58%),radial-gradient(circle_at_50%_100%,rgb(201_176_141_/_0.22),transparent_52%)]"
      />
      <div
        aria-hidden
        className="design-mat pointer-events-none absolute inset-0"
      />

      <div className="pointer-events-none absolute left-4 top-3 z-10 flex items-center gap-2 text-[10px] text-ink-3">
        <span className="font-mono tabular-nums">1024 × 1024</span>
        <span className="size-px bg-line-strong" />
        <span>拖动贴纸调整位置</span>
      </div>

      <div
        ref={viewportRef}
        className="scroll-area relative z-[1] min-h-0 flex-1 overflow-auto overscroll-contain"
      >
        <div className="flex h-max min-h-full w-max min-w-full items-center justify-center p-9">
          <div
            className="relative shrink-0"
            style={{ width: CANVAS_SIZE * scale, height: CANVAS_SIZE * scale }}
          >
            <span className="pointer-events-none absolute -left-2 -top-2 size-2 border-l border-t border-ink-3/55" />
            <span className="pointer-events-none absolute -right-2 -top-2 size-2 border-r border-t border-ink-3/55" />
            <span className="pointer-events-none absolute -bottom-2 -left-2 size-2 border-b border-l border-ink-3/55" />
            <span className="pointer-events-none absolute -bottom-2 -right-2 size-2 border-b border-r border-ink-3/55" />

            <div
              aria-hidden
              className="transparency-grid pointer-events-none absolute inset-0"
            />

            <div
              ref={stageRef}
              data-design-stage
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) onSelect(null)
              }}
              onDragEnter={(event) => {
                if (
                  Array.from(event.dataTransfer.types).includes(
                    DESIGN_DRAG_MIME,
                  )
                ) {
                  event.preventDefault()
                  setDropActive(true)
                }
              }}
              onDragOver={(event) => {
                if (
                  Array.from(event.dataTransfer.types).includes(
                    DESIGN_DRAG_MIME,
                  )
                ) {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'copy'
                }
              }}
              onDragLeave={(event) => {
                // 只在真正离开画布边界时收起提示；子元素之间切换不算
                const rect = event.currentTarget.getBoundingClientRect()
                if (
                  event.clientX < rect.left ||
                  event.clientX > rect.right ||
                  event.clientY < rect.top ||
                  event.clientY > rect.bottom
                ) {
                  setDropActive(false)
                }
              }}
              onDrop={handleDrop}
              className={cn(
                'relative overflow-hidden shadow-[0_2px_2px_rgb(80_58_34_/_0.08),0_26px_60px_-30px_rgb(80_58_34_/_0.55)]',
                dropActive && 'ring-2 ring-brand/70',
              )}
              style={{
                width: CANVAS_SIZE,
                height: CANVAS_SIZE,
                backgroundColor: doc.background,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              {doc.layers.map((layer) => {
                if (!layer.visible) return null
                return (
                  <DesignLayerNode
                    key={layer.id}
                    layer={layer}
                    onPointerDown={beginMove}
                  />
                )
              })}

              {selected && selected.visible ? (
                <div
                  className="pointer-events-none absolute"
                  style={{
                    left: selected.x,
                    top: selected.y,
                    width: LAYER_BASE_SIZE,
                    height: LAYER_BASE_SIZE,
                    transform: `translate(-50%, -50%) rotate(${selected.rotation}deg) scale(${selected.scale})`,
                    transformOrigin: 'center',
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      borderColor: 'var(--color-brand)',
                      borderStyle: 'solid',
                      borderWidth: Math.max(1, 1.5 * inverse),
                      boxShadow: `0 0 0 ${Math.max(1, inverse)}px rgb(255 255 255 / 0.6)`,
                    }}
                  />
                  <button
                    type="button"
                    aria-label="拖动调整大小"
                    onPointerDown={(event) => beginResize(event, selected)}
                    className="pointer-events-auto absolute cursor-nwse-resize rounded-full border-white bg-brand shadow-[0_2px_6px_rgb(44_38_32_/_0.35)]"
                    style={{
                      width: handleSize,
                      height: handleSize,
                      right: -handleSize / 2,
                      bottom: -handleSize / 2,
                      borderWidth: Math.max(1, 1.5 * inverse),
                    }}
                  />
                </div>
              ) : null}

              {dropActive ? (
                <div className="pointer-events-none absolute inset-0 bg-brand/10" />
              ) : null}
            </div>

            {doc.layers.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <div className="flex w-[260px] max-w-[calc(100%_-_24px)] flex-col items-center gap-2 rounded-[18px] bg-white/85 px-6 py-7 text-center shadow-[0_16px_36px_-26px_rgb(80_58_34_/_0.55)] backdrop-blur-[3px]">
                  <span className="flex size-11 items-center justify-center rounded-[14px] border border-dashed border-line-strong bg-white/70 text-ink-3">
                    <MousePointer2 className="size-5" strokeWidth={1.8} />
                  </span>
                  <p className="text-[13px] font-semibold text-ink">
                    把贴纸拖进来
                  </p>
                  <p className="text-[10.5px] leading-4 text-ink-3">
                    也可以直接点击左侧素材
                  </p>
                </div>
              </div>
            ) : null}

            {dropActive ? (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-brand/10">
                <span className="rounded-full bg-white/95 px-4 py-1.5 text-[12px] font-semibold text-brand shadow-lift">
                  松手放进画布
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="absolute bottom-3.5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-line bg-white/95 p-1 shadow-[0_10px_30px_-18px_rgb(44_38_32_/_0.55)] backdrop-blur">
        <ZoomButton
          label="缩小"
          disabled={scale <= MIN_ZOOM + 0.001}
          onClick={() => zoomTo(scale - 0.1)}
        >
          <Minus className="size-3.5" strokeWidth={2.1} />
        </ZoomButton>
        <button
          type="button"
          title="点击适应画布"
          onClick={() => setZoomMode('fit')}
          className="h-7 min-w-[54px] rounded-full px-1.5 text-[11px] font-medium tabular-nums text-ink-2 transition-colors hover:bg-hover hover:text-ink"
        >
          {Math.round(scale * 100)}%
        </button>
        <ZoomButton
          label="放大"
          disabled={scale >= MAX_ZOOM - 0.001}
          onClick={() => zoomTo(scale + 0.1)}
        >
          <Plus className="size-3.5" strokeWidth={2.1} />
        </ZoomButton>
        <span className="mx-0.5 h-4 w-px bg-line" />
        <ZoomButton
          label="适应画布"
          active={zoomMode === 'fit'}
          onClick={() => setZoomMode('fit')}
        >
          <Scan className="size-3.5" strokeWidth={2} />
        </ZoomButton>
      </div>
    </div>
  )
}

function DesignLayerNode({
  layer,
  onPointerDown,
}: {
  layer: DesignLayer
  onPointerDown: (
    event: React.PointerEvent<HTMLDivElement>,
    layer: DesignLayer,
  ) => void
}) {
  const ghosts = motionGhosts(layer.effects)
  const ghostFilter = buildLayerFilter({ ...layer.effects, outline: false })

  return (
    <div
      data-design-layer
      onPointerDown={(event) => onPointerDown(event, layer)}
      className="absolute cursor-grab select-none active:cursor-grabbing"
      style={{
        left: layer.x,
        top: layer.y,
        width: LAYER_BASE_SIZE,
        height: LAYER_BASE_SIZE,
        opacity: layer.opacity,
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
        transformOrigin: 'center',
      }}
    >
      {ghosts.map((ghost, index) => (
        <img
          key={index}
          src={layer.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 size-full object-contain"
          style={{
            transform: `translate(${ghost.x}px, ${ghost.y}px)`,
            opacity: ghost.opacity,
            filter: ghostFilter,
          }}
        />
      ))}
      <img
        src={layer.src}
        alt={layer.name}
        draggable={false}
        className="pointer-events-none absolute inset-0 size-full object-contain"
        style={{ filter: buildLayerFilter(layer.effects) }}
      />
    </div>
  )
}

function ZoomButton({
  label,
  disabled,
  active,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-hover hover:text-ink disabled:pointer-events-none disabled:opacity-30',
        active && 'bg-brand-tint text-brand hover:bg-brand-tint hover:text-brand',
      )}
    >
      {children}
    </button>
  )
}
