import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type ToastKind = 'success' | 'error' | 'warning' | 'info'

interface ToastMessage {
  id: number
  message: string
  kind: ToastKind
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toastStyles: Record<ToastKind, { Icon: typeof Info; className: string }> = {
  success: { Icon: CircleCheck, className: 'border-l-[var(--success)]' },
  error: { Icon: CircleAlert, className: 'border-l-[var(--danger)]' },
  warning: { Icon: TriangleAlert, className: 'border-l-[var(--warning)]' },
  info: { Icon: Info, className: 'border-l-[var(--primary)]' },
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  const { Icon, className } = toastStyles[toast.kind]

  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(toast.id), toast.kind === 'error' || toast.kind === 'warning' ? 7000 : 4500)
    return () => window.clearTimeout(timeout)
  }, [onDismiss, toast.id, toast.kind])

  return (
    <div
      role={toast.kind === 'error' || toast.kind === 'warning' ? 'alert' : 'status'}
      aria-atomic="true"
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border border-l-4 border-[var(--border)] bg-[var(--card)] p-4 text-[var(--foreground)] shadow-lg ${className}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${toast.kind === 'error' ? 'text-[var(--danger)]' : toast.kind === 'warning' ? 'text-[var(--warning)]' : toast.kind === 'success' ? 'text-[var(--success)]' : 'text-[var(--primary)]'}`} aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm leading-5">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-[var(--secondary)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++nextId.current
    setToasts((current) => [...current, { id, message, kind }].slice(-4))
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] mx-auto flex w-full max-w-md flex-col gap-2 px-4 sm:left-auto sm:right-4 sm:mx-0 sm:px-0" aria-label="Notifications">
        {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />)}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}