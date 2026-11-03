import { cn } from '@/lib/cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  )
}
