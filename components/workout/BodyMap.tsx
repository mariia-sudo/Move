'use client'

import { useState } from 'react'

// ─── Area definitions (140 × 280 viewBox) ─────────────────────────────────────

type BodyView = 'front' | 'back'
type ShapeType = 'ellipse' | 'rect'

interface BodyArea {
  id: string
  label: string
  views: BodyView[]
  shape: ShapeType
  // ellipse
  cx?: number; cy?: number; rx?: number; ry?: number
  // rect
  x?: number; y?: number; w?: number; h?: number; r?: number
}

const AREAS: BodyArea[] = [
  // ── shared front+back ──
  { id: 'head',           label: 'Голова',        views: ['front','back'], shape:'ellipse', cx:70, cy:22, rx:20, ry:21 },
  { id: 'neck',           label: 'Шея',           views: ['front','back'], shape:'rect',    x:61,  y:42,  w:18,  h:13, r:3 },
  { id: 'left_shoulder',  label: 'Л. плечо',      views: ['front','back'], shape:'ellipse', cx:25, cy:66, rx:19, ry:13 },
  { id: 'right_shoulder', label: 'П. плечо',      views: ['front','back'], shape:'ellipse', cx:115,cy:66, rx:19, ry:13 },
  { id: 'left_arm',       label: 'Л. рука',       views: ['front','back'], shape:'rect',    x:4,   y:55,  w:19,  h:74, r:7 },
  { id: 'right_arm',      label: 'П. рука',       views: ['front','back'], shape:'rect',    x:117, y:55,  w:19,  h:74, r:7 },
  // ── front only ──
  { id: 'chest',          label: 'Грудь',         views: ['front'], shape:'rect',    x:37, y:55, w:66, h:44, r:5 },
  { id: 'abs',            label: 'Пресс',         views: ['front'], shape:'rect',    x:39, y:99, w:62, h:39, r:5 },
  { id: 'left_hip',       label: 'Л. бедро',      views: ['front'], shape:'rect',    x:38, y:138,w:25, h:35, r:5 },
  { id: 'right_hip',      label: 'П. бедро',      views: ['front'], shape:'rect',    x:77, y:138,w:25, h:35, r:5 },
  { id: 'left_thigh',     label: 'Л. квадр.',     views: ['front'], shape:'rect',    x:39, y:173,w:23, h:42, r:5 },
  { id: 'right_thigh',    label: 'П. квадр.',     views: ['front'], shape:'rect',    x:78, y:173,w:23, h:42, r:5 },
  { id: 'left_knee',      label: 'Л. колено',     views: ['front'], shape:'ellipse', cx:50, cy:230, rx:17, ry:12 },
  { id: 'right_knee',     label: 'П. колено',     views: ['front'], shape:'ellipse', cx:90, cy:230, rx:17, ry:12 },
  { id: 'left_shin',      label: 'Л. голень',     views: ['front'], shape:'rect',    x:35, y:242,w:28, h:34, r:7 },
  { id: 'right_shin',     label: 'П. голень',     views: ['front'], shape:'rect',    x:77, y:242,w:28, h:34, r:7 },
  // ── back only ──
  { id: 'upper_back',     label: 'Верх. спина',   views: ['back'], shape:'rect',    x:37, y:55,  w:66, h:44, r:5 },
  { id: 'lower_back',     label: 'Поясница',      views: ['back'], shape:'rect',    x:39, y:99,  w:62, h:39, r:5 },
  { id: 'left_glute',     label: 'Л. ягодица',   views: ['back'], shape:'rect',    x:38, y:138, w:25, h:35, r:5 },
  { id: 'right_glute',    label: 'П. ягодица',   views: ['back'], shape:'rect',    x:77, y:138, w:25, h:35, r:5 },
  { id: 'left_hamstring', label: 'Л. задн. бедро',views: ['back'], shape:'rect',    x:39, y:173, w:23, h:42, r:5 },
  { id: 'right_hamstring',label: 'П. задн. бедро',views: ['back'], shape:'rect',    x:78, y:173, w:23, h:42, r:5 },
  { id: 'left_calf',      label: 'Л. икра',       views: ['back'], shape:'ellipse', cx:50, cy:230, rx:17, ry:12 },
  { id: 'right_calf',     label: 'П. икра',       views: ['back'], shape:'ellipse', cx:90, cy:230, rx:17, ry:12 },
  { id: 'left_heel',      label: 'Л. голень',     views: ['back'], shape:'rect',    x:35, y:242, w:28, h:34, r:7 },
  { id: 'right_heel',     label: 'П. голень',     views: ['back'], shape:'rect',    x:77, y:242, w:28, h:34, r:7 },
]

export function areaLabel(id: string): string {
  return AREAS.find(a => a.id === id)?.label ?? id
}

// ─── Component ─────────────────────────────────────────────────────────────────


function AreaShape({ area, active, onToggle, readonly }: {
  area: BodyArea
  active: boolean
  onToggle: () => void
  readonly?: boolean
}) {
  const fill = active ? 'rgba(255,107,53,0.65)' : 'rgba(255,255,255,0.07)'
  const stroke = active ? '#FF6B35' : 'rgba(255,255,255,0.13)'
  const sw = active ? 2 : 1.5

  const common = {
    fill, stroke, strokeWidth: sw,
    onClick: readonly ? undefined : onToggle,
    style: { cursor: readonly ? 'default' : 'pointer', transition: 'fill 0.15s, stroke 0.15s' },
  }

  if (area.shape === 'ellipse') {
    return <ellipse {...common} cx={area.cx} cy={area.cy} rx={area.rx} ry={area.ry} />
  }
  return <rect {...common} x={area.x} y={area.y} width={area.w} height={area.h} rx={area.r ?? 4} />
}

interface BodyMapProps {
  selected: string[]
  onChange: (areas: string[]) => void
  readonly?: boolean
}

export function BodyMap({ selected, onChange, readonly }: BodyMapProps) {
  const [view, setView] = useState<BodyView>('front')

  const toggle = (id: string) => {
    if (readonly) return
    onChange(selected.includes(id) ? selected.filter(a => a !== id) : [...selected, id])
  }

  const visible = AREAS.filter(a => a.views.includes(view))
  const selectedLabels = selected.map(id => areaLabel(id))

  return (
    <div>
      {/* View toggle */}
      <div className="flex gap-2 mb-4">
        {(['front', 'back'] as BodyView[]).map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
              view === v
                ? 'bg-[#FF6B35]/15 border-[#FF6B35]/40 text-[#FF6B35]'
                : 'bg-[#1A1A1A] border-[#333] text-gray-500 hover:text-gray-300'
            }`}
          >
            {v === 'front' ? 'Спереди' : 'Сзади'}
          </button>
        ))}
      </div>

      {/* SVG */}
      <div className="flex justify-center">
        <svg
          viewBox="0 0 140 280"
          width="180"
          height="360"
          aria-label="Карта тела"
        >
          {/* Body silhouette — subtle background outlines */}
          {/* Head */}
          <ellipse cx={70} cy={22} rx={21} ry={22} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          {/* Torso outline */}
          <path
            d="M25,55 Q70,48 115,55 L118,140 Q95,152 70,152 Q45,152 22,140 Z"
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
          {/* Legs outline */}
          <path
            d="M42,152 L35,278 L63,278 L70,210 L77,278 L105,278 L98,152 Z"
            fill="rgba(255,255,255,0.02)"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />

          {/* Clickable areas — render in z order (larger behind, smaller in front) */}
          {/* Large areas first */}
          {visible.filter(a => a.shape === 'rect').map(area => (
            <AreaShape key={area.id} area={area} active={selected.includes(area.id)} onToggle={() => toggle(area.id)} readonly={readonly} />
          ))}
          {visible.filter(a => a.shape === 'ellipse').map(area => (
            <AreaShape key={area.id} area={area} active={selected.includes(area.id)} onToggle={() => toggle(area.id)} readonly={readonly} />
          ))}

          {/* Area labels on selected items */}
          {visible.filter(a => selected.includes(a.id)).map(area => {
            const labelX = area.shape === 'ellipse' ? area.cx! : (area.x! + area.w! / 2)
            const labelY = area.shape === 'ellipse' ? area.cy! : (area.y! + area.h! / 2)
            return (
              <text
                key={`lbl-${area.id}`}
                x={labelX}
                y={labelY + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={5.5}
                fontWeight="600"
                fill="white"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {area.label.split(' ').slice(-1)[0]}
              </text>
            )
          })}
        </svg>
      </div>

      {/* Selected list */}
      {selected.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {selectedLabels.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggle(selected[i])}
              className="px-2.5 py-1 bg-[#FF6B35]/15 border border-[#FF6B35]/25 text-[#FF6B35] text-xs rounded-lg font-medium flex items-center gap-1"
            >
              {label}
              <span className="text-[#FF6B35]/60 text-xs">×</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-600 text-center">
          Нажмите на область тела, если что-то болит
        </p>
      )}
    </div>
  )
}
