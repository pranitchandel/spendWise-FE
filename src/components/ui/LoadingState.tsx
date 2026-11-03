import { Spinner } from './Spinner'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <Spinner className="h-7 w-7" />
      <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
    </div>
  )
}
