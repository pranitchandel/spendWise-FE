import { Moon, Settings, Sun } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/Button'

export function Header({ title }: { title: string }) {
  const { user } = useAuth()
  const { resolved, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_90%,transparent)] px-4 backdrop-blur lg:h-16 lg:px-6">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
        >
          {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Link
          to="/settings"
          className="hidden items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-[var(--secondary)] hover:bg-[var(--muted)] sm:flex"
        >
          <Settings className="h-4 w-4" />
          <span className="max-w-28 truncate">{user?.name ?? 'Account'}</span>
        </Link>
      </div>
    </header>
  )
}
