import {
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Contrast,
  Copy,
  Droplets,
  Eye,
  EyeOff,
  Layers,
  Trash2,
  Wind,
} from 'lucide-react'

import { BackgroundControl } from '@/features/design/BackgroundControl'
import { cn } from '@/lib/cn'
import {
  MAX_LAYER_SCALE,
  MIN_LAYER_SCALE,
  OUTLINE_COLORS,
  type DesignDocument,
  type DesignLayer,
  type LayerEffects,
} from '@/features/design/model'

interface InspectorPanelProps {
  doc: DesignDocument
  selectedId: string | null
  onSelect: (id: string | null) => void
  onBackground: (color: string) => void
  onLayerChange: (id: string, patch: Partial<DesignLayer>, key?: string) => void
  onEffectsChange: (
    id: string,
    patch: Partial<LayerEffects>,
    key?: string,
  ) => void
  onShiftLayer: (id: string, direction: 1 | -1) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

/** 右侧属性面板：背景、图层栈、选中贴纸的变换与滤镜。 */
export function InspectorPanel({
  doc,
  selectedId,
  onSelect,
  onBackground,
  onLayerChange,
  onEffectsChange,
  onShiftLayer,
  onDuplicate,
  onDelete,
}: InspectorPanelProps) {
  const selected = doc.layers.find((layer) => layer.id === selectedId) ?? null
  const ordered = [...doc.layers].reverse()

  return (
    <aside className="flex w-[274px] shrink-0 flex-col border-l border-line bg-surface-raised">
      <div className="scroll-area min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <BackgroundControl value={doc.background} onChange={onBackground} />

        <section className="border-b border-line/75 px-3.5 py-3.5">
          <div className="flex items-center justify-between">
            <SectionTitle icon={<Layers className="size-3" />}>图层</SectionTitle>
            <span className="text-[10px] tabular-nums text-ink-3">
              {doc.layers.length}
            </span>
          </div>

          {ordered.length === 0 ? (
            <p className="mt-3 rounded-[9px] border border-dashed border-line-strong/70 px-3 py-4 text-center text-[11px] leading-4 text-ink-3">
              画布还是空的
              <br />
              从左边拖一张贴纸进来
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-0.5">
              {ordered.map((layer) => {
                const index = doc.layers.findIndex((item) => item.id === layer.id)
                const active = layer.id === selectedId
                return (
                  <div
                    key={layer.id}
                    data-design-layer-row
                    className={cn(
                      'flex h-[34px] items-center gap-1 rounded-[8px] px-1 transition-colors',
                      active ? 'bg-brand-tint/75' : 'hover:bg-hover',
                    )}
                  >
                    <button
                      type="button"
                      aria-label={layer.visible ? '隐藏图层' : '显示图层'}
                      aria-pressed={layer.visible}
                      onClick={(event) => {
                        event.stopPropagation()
                        onLayerChange(
                          layer.id,
                          { visible: !layer.visible },
                          `visible-${layer.id}`,
                        )
                      }}
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-white hover:text-ink',
                        !layer.visible && 'text-ink-3/55',
                      )}
                    >
                      {layer.visible ? (
                        <Eye className="size-3.5" strokeWidth={1.9} />
                      ) : (
                        <EyeOff className="size-3.5" strokeWidth={1.9} />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={`选择图层 ${layer.name}`}
                      aria-pressed={active}
                      onClick={() => onSelect(layer.id)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[5px] text-left outline-none focus-visible:ring-1 focus-visible:ring-brand/35"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-[5px] border border-line/80 bg-white">
                        <img
                          src={layer.src}
                          alt=""
                          draggable={false}
                          className="size-full object-contain"
                        />
                      </span>
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-[11.5px]',
                          active ? 'font-medium text-ink' : 'text-ink-2',
                          !layer.visible && 'line-through opacity-50',
                        )}
                      >
                        {layer.name}
                      </span>
                    </button>
                    {active ? (
                      <div className="flex shrink-0 items-center gap-px">
                        <TinyButton
                          label="上移一层"
                          disabled={index === doc.layers.length - 1}
                          onClick={(event) => {
                            event.stopPropagation()
                            onShiftLayer(layer.id, 1)
                          }}
                        >
                          <ChevronUp className="size-3" />
                        </TinyButton>
                        <TinyButton
                          label="下移一层"
                          disabled={index === 0}
                          onClick={(event) => {
                            event.stopPropagation()
                            onShiftLayer(layer.id, -1)
                          }}
                        >
                          <ChevronDown className="size-3" />
                        </TinyButton>
                        <TinyButton
                          label="复制图层"
                          onClick={(event) => {
                            event.stopPropagation()
                            onDuplicate(layer.id)
                          }}
                        >
                          <Copy className="size-3" />
                        </TinyButton>
                        <TinyButton
                          label="删除图层"
                          danger
                          onClick={(event) => {
                            event.stopPropagation()
                            onDelete(layer.id)
                          }}
                        >
                          <Trash2 className="size-3" />
                        </TinyButton>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {selected ? (
          <LayerControls
            key={selected.id}
            layer={selected}
            onLayerChange={(patch, key) => onLayerChange(selected.id, patch, key)}
            onEffectsChange={(patch, key) =>
              onEffectsChange(selected.id, patch, key)
            }
          />
        ) : (
          <div className="px-3.5 py-5 text-center text-[11px] leading-5 text-ink-3">
            选中一个图层后
            <br />
            可以调整位置、滤镜和动效
          </div>
        )}
      </div>
    </aside>
  )
}

function LayerControls({
  layer,
  onLayerChange,
  onEffectsChange,
}: {
  layer: DesignLayer
  onLayerChange: (patch: Partial<DesignLayer>, key?: string) => void
  onEffectsChange: (patch: Partial<LayerEffects>, key?: string) => void
}) {
  const effects = layer.effects
  const hasFilters =
    effects.outline || effects.motion || effects.grayscale || effects.blur > 0

  return (
    <section className="px-3.5 py-3.5">
      <div className="flex items-center gap-1.5">
        <h2 className="min-w-0 flex-1 truncate font-rounded text-[12.5px] font-semibold text-ink">
          {layer.name}
        </h2>
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            hasFilters ? 'bg-brand' : 'bg-line-strong',
          )}
          title={hasFilters ? '已应用滤镜' : '未应用滤镜'}
        />
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <SliderRow
          label="缩放"
          value={`${Math.round(layer.scale * 100)}%`}
          min={MIN_LAYER_SCALE}
          max={MAX_LAYER_SCALE}
          step={0.01}
          current={layer.scale}
          onChange={(value) =>
            onLayerChange({ scale: value }, `scale-${layer.id}`)
          }
        />
        <SliderRow
          label="旋转"
          value={`${Math.round(layer.rotation)}°`}
          min={-180}
          max={180}
          step={1}
          current={layer.rotation}
          onChange={(value) =>
            onLayerChange({ rotation: value }, `rotation-${layer.id}`)
          }
        />
        <SliderRow
          label="不透明度"
          value={`${Math.round(layer.opacity * 100)}%`}
          min={0.05}
          max={1}
          step={0.01}
          current={layer.opacity}
          onChange={(value) =>
            onLayerChange({ opacity: value }, `opacity-${layer.id}`)
          }
        />
      </div>

      <div className="mt-4 border-t border-line/75 pt-3.5">
        <SectionTitle>滤镜</SectionTitle>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <EffectToggle
            icon={<CircleDashed className="size-3.5" />}
            label="描边"
            active={effects.outline}
            onClick={() => onEffectsChange({ outline: !effects.outline })}
          />
          <EffectToggle
            icon={<Wind className="size-3.5" />}
            label="动感"
            active={effects.motion}
            onClick={() => onEffectsChange({ motion: !effects.motion })}
          />
          <EffectToggle
            icon={<Contrast className="size-3.5" />}
            label="灰度"
            active={effects.grayscale}
            onClick={() =>
              onEffectsChange({ grayscale: !effects.grayscale })
            }
          />
          <EffectToggle
            icon={<Droplets className="size-3.5" />}
            label="模糊"
            active={effects.blur > 0}
            onClick={() =>
              onEffectsChange(
                { blur: effects.blur > 0 ? 0 : 3 },
                `blur-${layer.id}`,
              )
            }
          />
        </div>

        {effects.outline ? (
          <div className="mt-3 rounded-[9px] bg-canvas-top/80 px-2.5 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10.5px] text-ink-2">颜色</span>
              <div className="ml-auto flex items-center gap-1">
                {OUTLINE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`描边色 ${color}`}
                    aria-pressed={
                      effects.outlineColor.toLowerCase() === color.toLowerCase()
                    }
                    onClick={() =>
                      onEffectsChange(
                        { outlineColor: color },
                        `outline-color-${layer.id}`,
                      )
                    }
                    className={cn(
                      'size-4 rounded-full border transition-transform hover:scale-110',
                      effects.outlineColor.toLowerCase() === color.toLowerCase()
                        ? 'border-brand ring-2 ring-brand/25 ring-offset-1'
                        : 'border-line-strong/80',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-2">
              <SliderRow
                label="粗细"
                value={`${Math.round(effects.outlineWidth)} px`}
                min={2}
                max={24}
                step={1}
                current={effects.outlineWidth}
                onChange={(value) =>
                  onEffectsChange(
                    { outlineWidth: value },
                    `outline-width-${layer.id}`,
                  )
                }
                compact
              />
            </div>
          </div>
        ) : null}

        {effects.motion ? (
          <div className="mt-2 rounded-[9px] bg-canvas-top/80 px-2.5 py-2.5">
            <SliderRow
              label="拖影"
              value={`${Math.round(effects.motionStrength)} px`}
              min={8}
              max={120}
              step={1}
              current={effects.motionStrength}
              onChange={(value) =>
                onEffectsChange(
                  { motionStrength: value },
                  `motion-strength-${layer.id}`,
                )
              }
              compact
            />
            <div className="mt-2">
              <SliderRow
                label="方向"
                value={`${Math.round(effects.motionAngle)}°`}
                min={0}
                max={360}
                step={1}
                current={effects.motionAngle}
                onChange={(value) =>
                  onEffectsChange(
                    { motionAngle: value },
                    `motion-angle-${layer.id}`,
                  )
                }
                compact
              />
            </div>
          </div>
        ) : null}

        {effects.blur > 0 ? (
          <div className="mt-2 rounded-[9px] bg-canvas-top/80 px-2.5 py-2.5">
            <SliderRow
              label="模糊"
              value={`${effects.blur.toFixed(0)} px`}
              min={0.5}
              max={12}
              step={0.5}
              current={effects.blur}
              onChange={(value) =>
                onEffectsChange({ blur: value }, `blur-value-${layer.id}`)
              }
              compact
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}

function SectionTitle({
  icon,
  children,
}: {
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <h2 className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.04em] text-ink-3">
      {icon}
      {children}
    </h2>
  )
}

function EffectToggle({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-8 items-center gap-1.5 rounded-[8px] border px-2 text-[11px] font-medium transition-colors',
        active
          ? 'border-brand/40 bg-brand-tint text-brand'
          : 'border-line bg-white text-ink-2 hover:border-line-strong hover:text-ink',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function TinyButton({
  label,
  danger,
  disabled,
  onClick,
  children,
}: {
  label: string
  danger?: boolean
  disabled?: boolean
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
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
        'flex size-[19px] items-center justify-center rounded-[5px] text-ink-3 transition-colors hover:bg-white hover:text-ink disabled:pointer-events-none disabled:opacity-25',
        danger && 'hover:bg-danger-soft hover:text-danger',
      )}
    >
      {children}
    </button>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  current,
  onChange,
  compact,
}: {
  label: string
  value: string
  min: number
  max: number
  step: number
  current: number
  onChange: (value: number) => void
  compact?: boolean
}) {
  const percent = ((current - min) / (max - min)) * 100
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[10.5px]">
        <span className="text-ink-2">{label}</span>
        <span
          className={cn(
            'tabular-nums text-ink-3',
            compact && 'text-[10px]',
          )}
        >
          {value}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className={cn('design-range mt-1.5', compact && 'design-range-compact')}
        style={
          {
            '--range-fill': `${percent}%`,
          } as React.CSSProperties
        }
      />
    </label>
  )
}
