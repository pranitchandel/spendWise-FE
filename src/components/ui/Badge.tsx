import { cn } from '@/lib/cn'

const tones = {
  default: 'bg-[var(--muted)] text-[var(--foreground)]',
  primary: 'bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)]',
  success: 'bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)]',
  warning: 'bg-[color-mix(in_srgb,var(--warning)_20%,transparent)] text-[var(--warning)]',
  danger: 'bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] text-[var(--danger)]',
} as const

export function Badge({
  children,
  tone = 'default',
  className,
}: {
  children: React.ReactNode
  tone?: keyof typeof tones
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
