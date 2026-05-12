'use client'

import Link from 'next/link'
import { SPORT_CONFIG, SPORT_GROUPS } from '@/lib/sports'

export default function SportPickerPage() {
  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Записать тренировку</h1>
        <p className="text-gray-500 text-sm mt-1">Выберите вид спорта</p>
      </div>

      {SPORT_GROUPS.map(group => (
        <div key={group.label}>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            {group.label}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {group.sports.map(sport => {
              const cfg = SPORT_CONFIG[sport]
              return (
                <Link
                  key={sport}
                  href={`/workout/${sport}`}
                  className="flex items-center gap-3 bg-[#111] border border-[#222] hover:border-[#FF6B35]/30 hover:bg-[#FF6B35]/5 rounded-2xl p-4 transition-all group"
                >
                  <span className="text-2xl">{cfg.emoji}</span>
                  <span className="text-sm font-semibold text-white group-hover:text-[#FF6B35] transition-colors">
                    {cfg.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
