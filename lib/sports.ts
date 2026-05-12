// Single source of truth for all sport types across the app

export type BadgeColor = 'orange' | 'green' | 'blue' | 'purple' | 'gray' | 'red'
export type SportCategory = 'strength' | 'cardio' | 'racket' | 'team' | 'general'

export type SportType =
  | 'weightlifting' | 'running'   | 'squash'      | 'padel'
  | 'yoga'          | 'swimming'  | 'cycling'     | 'football'
  | 'basketball'    | 'volleyball'| 'boxing'      | 'crossfit'
  | 'tennis'        | 'hockey'

export interface SportConfig {
  emoji: string
  label: string
  color: BadgeColor
  colorHex: string
  category: SportCategory
}

export const SPORT_CONFIG: Record<SportType, SportConfig> = {
  weightlifting: { emoji: '🏋️', label: 'Силовые',    color: 'orange', colorHex: '#FF6B35', category: 'strength' },
  running:       { emoji: '🏃', label: 'Бег',         color: 'blue',   colorHex: '#3B82F6', category: 'cardio'   },
  yoga:          { emoji: '🧘', label: 'Йога',        color: 'purple', colorHex: '#A855F7', category: 'general'  },
  swimming:      { emoji: '🏊', label: 'Плавание',    color: 'blue',   colorHex: '#3B82F6', category: 'cardio'   },
  cycling:       { emoji: '🚴', label: 'Велосипед',   color: 'green',  colorHex: '#22C55E', category: 'cardio'   },
  crossfit:      { emoji: '💪', label: 'Crossfit',    color: 'orange', colorHex: '#FF6B35', category: 'general'  },
  boxing:        { emoji: '🥊', label: 'Бокс',        color: 'red',    colorHex: '#EF4444', category: 'general'  },
  squash:        { emoji: '🎾', label: 'Сквош',       color: 'green',  colorHex: '#22C55E', category: 'racket'   },
  padel:         { emoji: '🏓', label: 'Падел',      color: 'purple', colorHex: '#A855F7', category: 'racket'   },
  tennis:        { emoji: '🎾', label: 'Теннис',      color: 'green',  colorHex: '#22C55E', category: 'racket'   },
  football:      { emoji: '⚽', label: 'Футбол',      color: 'green',  colorHex: '#22C55E', category: 'team'     },
  basketball:    { emoji: '🏀', label: 'Баскетбол',   color: 'orange', colorHex: '#FF6B35', category: 'team'     },
  volleyball:    { emoji: '🏐', label: 'Волейбол',    color: 'blue',   colorHex: '#3B82F6', category: 'team'     },
  hockey:        { emoji: '🏒', label: 'Хоккей',      color: 'blue',   colorHex: '#3B82F6', category: 'team'     },
}

export const ALL_SPORTS = Object.keys(SPORT_CONFIG) as SportType[]

export function isSportType(s: string): s is SportType {
  return s in SPORT_CONFIG
}

// Grouped for UI (sport picker, nav)
export const SPORT_GROUPS: { label: string; sports: SportType[] }[] = [
  { label: 'Силовые и фитнес', sports: ['weightlifting', 'crossfit', 'boxing', 'yoga'] },
  { label: 'Кардио',           sports: ['running', 'swimming', 'cycling'] },
  { label: 'С ракеткой',       sports: ['squash', 'padel', 'tennis'] },
  { label: 'Командные',        sports: ['football', 'basketball', 'volleyball', 'hockey'] },
]

// Used in pain insight tooltips on progress page
export const SPORT_GENITIVE: Record<SportType, string> = {
  weightlifting: 'силовых',    running:    'пробежек',  yoga:       'йоги',
  swimming:      'плавания',   cycling:    'велосипеда',crossfit:   'Crossfit',
  boxing:        'бокса',      squash:     'сквоша',    padel:      'паделя',
  tennis:        'тенниса',    football:   'футбола',   basketball: 'баскетбола',
  volleyball:    'волейбола',  hockey:     'хоккея',
}
