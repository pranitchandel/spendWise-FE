import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'

export function PaginationControls({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  limit: number
  onPageChange: (page: number) => void
}) {
  const firstItem = total === 0 ? 0 : (page - 1) * limit + 1
  const lastItem = Math.min(page * limit, total)

  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
    <p className="text-xs text-[var(--secondary)]">Showing {firstItem}–{lastItem} of {total}</p>
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" />Previous</Button>
      <span className="min-w-16 text-center text-xs tabular-nums text-[var(--secondary)]">{page} / {Math.max(totalPages, 1)}</span>
      <Button type="button" size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">Next<ChevronRight className="h-4 w-4" /></Button>
    </div>
  </div>
}
