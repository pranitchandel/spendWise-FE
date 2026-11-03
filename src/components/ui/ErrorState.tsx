import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

export function ErrorState({
  message = 'Failed to load data',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-[var(--danger)]" />
      <p className="text-sm text-[var(--muted-foreground)]">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}
