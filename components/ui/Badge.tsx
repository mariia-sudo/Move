import { HTMLAttributes } from 'react'

type BadgeVariant = 'orange' | 'green' | 'blue' | 'purple' | 'gray' | 'red'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variants: Record<BadgeVariant, string> = {
  orange: 'bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/20',
  green: 'bg-green-500/15 text-green-400 border border-green-500/20',
  blue: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  purple: 'bg-purple-500/15 text-purple-400 border border-purple-500/20',
  gray: 'bg-white/5 text-gray-400 border border-white/10',
  red: 'bg-red-500/15 text-red-400 border border-red-500/20',
}

export function Badge({ variant = 'gray', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
