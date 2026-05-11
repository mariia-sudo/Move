'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Dumbbell, TrendingUp, Heart, LogOut, Menu, X, Settings, Download, History } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Главная' },
  { href: '/progress',  icon: TrendingUp,      label: 'Прогресс' },
  { href: '/history',   icon: History,         label: 'История'  },
  { href: '/cycle',     icon: Heart,           label: 'Цикл'     },
  { href: '/import',    icon: Download,        label: 'Импорт'   },
  { href: '/settings',  icon: Settings,        label: 'Настройки'},
]

// Bottom bar shows only the 3 most-visited pages + Log
const bottomNavItems = navItems.slice(0, 3)

export function AppNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-60 bg-[#0D0D0D] border-r border-[#1A1A1A] z-40">
        <div className="p-5 border-b border-[#1A1A1A]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FF6B35] flex items-center justify-center">
              <Dumbbell size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-gradient">Moova</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                pathname === href || pathname.startsWith(href + '/')
                  ? 'bg-[#FF6B35]/10 text-[#FF6B35] border border-[#FF6B35]/15'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}

          <div className="pt-4">
            <p className="px-3 text-xs text-gray-600 uppercase tracking-wider font-semibold mb-2">Записать</p>
            {[
              { href: '/workout/weightlifting', label: 'Силовые', emoji: '🏋️' },
              { href: '/workout/running', label: 'Бег', emoji: '🏃' },
              { href: '/workout/squash', label: 'Сквош', emoji: '🎾' },
              { href: '/workout/padel', label: 'Падель', emoji: '🏓' },
            ].map(({ href, label, emoji }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  pathname === href
                    ? 'bg-[#FF6B35]/10 text-[#FF6B35] border border-[#FF6B35]/15'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="text-base">{emoji}</span>
                {label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-[#1A1A1A]">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/5 transition-all w-full"
          >
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-[#1A1A1A]">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FF6B35] flex items-center justify-center">
              <Dumbbell size={14} className="text-white" />
            </div>
            <span className="font-bold text-gradient">Moova</span>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="text-gray-400 hover:text-white p-1">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl pt-14">
          <nav className="p-4 space-y-1">
            {navItems.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  pathname === href ? 'bg-[#FF6B35]/10 text-[#FF6B35]' : 'text-gray-300'
                }`}
              >
                <Icon size={20} />
                {label}
              </Link>
            ))}
            <div className="pt-4 border-t border-[#1A1A1A]">
              <p className="px-4 text-xs text-gray-600 uppercase tracking-wider font-semibold mb-2">Записать</p>
              {[
                { href: '/workout/weightlifting', label: 'Силовые', emoji: '🏋️' },
                { href: '/workout/running', label: 'Бег', emoji: '🏃' },
                { href: '/workout/squash', label: 'Сквош', emoji: '🎾' },
                { href: '/workout/padel', label: 'Падель', emoji: '🏓' },
              ].map(({ href, label, emoji }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-300"
                >
                  <span className="text-lg">{emoji}</span>
                  {label}
                </Link>
              ))}
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 w-full"
            >
              <LogOut size={20} />
              Выйти
            </button>
          </nav>
        </div>
      )}

      {/* Mobile bottom nav — Dashboard, Progress, History + Log */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0D0D0D]/95 backdrop-blur-xl border-t border-[#1A1A1A] px-2 pb-safe">
        <div className="flex items-center justify-around py-2">
          {bottomNavItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                pathname === href || pathname.startsWith(href + '/') ? 'text-[#FF6B35]' : 'text-gray-500'
              }`}
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          ))}
          <Link
            href="/workout/weightlifting"
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-gray-500"
          >
            <Dumbbell size={22} />
            <span className="text-[10px] font-medium">Запись</span>
          </Link>
        </div>
      </nav>
    </>
  )
}
