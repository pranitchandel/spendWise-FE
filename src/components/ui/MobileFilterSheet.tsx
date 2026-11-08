import { SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

export function MobileFilterSheet({
  open,
  onOpenChange,
  onApply,
  activeCount,
  iconOnly = false,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply?: () => void
  activeCount: number
  iconOnly?: boolean
  children: ReactNode
}) {
  return <>
    <Button type="button" variant="outline" size={iconOnly ? 'icon' : 'md'} className={`relative sm:hidden ${iconOnly ? 'h-11 w-11' : ''}`} onClick={() => onOpenChange(true)} aria-label="Filters" title="Filters" aria-expanded={open} aria-haspopup="dialog">
      <SlidersHorizontal className="h-4 w-4" />{iconOnly ? null : 'Filters'}
      {activeCount > 0 ? <span className={`grid h-5 min-w-5 place-items-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-semibold text-white ${iconOnly ? 'absolute -right-1 -top-1' : 'ml-1'}`}>{activeCount}</span> : null}
    </Button>
    <Modal open={open} onClose={() => onOpenChange(false)} title="Filters">
      <div className="space-y-4">{children}<Button type="button" className="w-full" onClick={() => { onApply?.(); onOpenChange(false) }}>Show results</Button></div>
    </Modal>
  </>
}
