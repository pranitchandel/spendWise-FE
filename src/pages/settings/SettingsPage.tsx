import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { LogOut, Save } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '@/api/auth'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useTheme } from '@/contexts/ThemeContext'
import type { ThemePreference } from '@/types'

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  preferredCurrency: z.string().length(3, 'Use a three-letter currency code'),
  timezone: z.string().min(1, 'Timezone is required'),
  theme: z.enum(['light', 'dark', 'system']),
})
type ProfileForm = z.infer<typeof profileSchema>
const fieldClass = 'h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]'

export function SettingsPage() {
  const { user, setUser, logout } = useAuth()
  const { showToast } = useToast()
  const { setTheme } = useTheme()
  const navigate = useNavigate()
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      preferredCurrency: user?.preferredCurrency ?? 'INR',
      timezone: user?.timezone ?? 'Asia/Kolkata',
      theme: user?.theme ?? 'system',
    },
  })

  useEffect(() => {
    if (!user) return
    form.reset({ name: user.name, preferredCurrency: user.preferredCurrency, timezone: user.timezone, theme: user.theme })
  }, [form, user])

  const saveMutation = useMutation({
    mutationFn: (values: ProfileForm) => authApi.updateProfile(values),
    onSuccess: (updated) => {
      setUser(updated)
      setTheme(updated.theme as ThemePreference)
      showToast('Profile updated.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })

  async function signOut() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div><p className="text-sm font-medium text-[var(--primary)]">Personal preferences</p><h2 className="mt-1 text-2xl font-semibold">Settings</h2></div>
      <Card className="p-5 sm:p-7">
        <h3 className="font-semibold">Profile</h3>
        <p className="mt-1 text-sm text-[var(--secondary)]">{user?.email}</p>
        <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} noValidate>
          <label htmlFor="profile-name" className="space-y-2 text-sm font-medium">Name<Input id="profile-name" {...form.register('name')} error={form.formState.errors.name?.message} /></label>
          <label htmlFor="profile-currency" className="space-y-2 text-sm font-medium">Currency code<Input id="profile-currency" maxLength={3} {...form.register('preferredCurrency')} error={form.formState.errors.preferredCurrency?.message} /></label>
          <label htmlFor="profile-timezone" className="space-y-2 text-sm font-medium">Timezone<Input id="profile-timezone" {...form.register('timezone')} error={form.formState.errors.timezone?.message} /></label>
          <label htmlFor="profile-theme" className="space-y-2 text-sm font-medium">Theme<select id="profile-theme" className={fieldClass} {...form.register('theme')}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <div className="sm:col-span-2"><Button type="submit" disabled={saveMutation.isPending}><Save className="h-4 w-4" />{saveMutation.isPending ? 'Saving…' : 'Save profile'}</Button></div>
        </form>
      </Card>
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div><h3 className="font-semibold">Sign out</h3><p className="mt-1 text-sm text-[var(--secondary)]">End this session on this device.</p></div>
        <Button variant="outline" onClick={signOut}><LogOut className="h-4 w-4" />Sign out</Button>
      </Card>
    </div>
  )
}