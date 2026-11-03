import { cn } from '@/lib/cn'
import { budgetStatus } from '@/lib/constants'

export function Progress({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const clamped = Math.max(0, Math.min(value, 100))
  const status = budgetStatus(value)
  const color =
    status === 'exceeded'
      ? 'bg-[var(--danger)]'
      : status === 'high'
        ? 'bg-[var(--warning)]'
        : status === 'warning'
          ? 'bg-[var(--warning)]'
          : 'bg-[var(--success)]'

  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]', className)}>
      <div
        className={cn('h-full rounded-full transition-all', color)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
