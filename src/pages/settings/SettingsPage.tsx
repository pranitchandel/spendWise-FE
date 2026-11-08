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
  email: z.string().email('Enter a valid email address'),
  name: z.string().trim().min(1, 'Name is required').max(120),
  preferredCurrency: z.string().length(3, 'Use a three-letter currency code'),
  timezone: z.string().min(1, 'Timezone is required'),
  theme: z.enum(['light', 'dark', 'system']),
})
type ProfileForm = z.infer<typeof profileSchema>
const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: z.string().min(8, 'Use at least 8 characters').max(128),
  confirmPassword: z.string().min(1, 'Confirm your new password'),
}).refine((values) => values.newPassword === values.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
type PasswordForm = z.infer<typeof passwordSchema>
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
      email: user?.email ?? '',
      preferredCurrency: user?.preferredCurrency ?? 'INR',
      timezone: user?.timezone ?? 'Asia/Kolkata',
      theme: user?.theme ?? 'system',
    },
  })

  useEffect(() => {
    if (!user) return
    form.reset({ email: user.email, name: user.name, preferredCurrency: user.preferredCurrency, timezone: user.timezone, theme: user.theme })
  }, [form, user])
  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const saveMutation = useMutation({
    mutationFn: (values: ProfileForm) => authApi.updateProfile(values),
    onSuccess: (updated) => {
      setUser(updated)
      setTheme(updated.theme as ThemePreference)
      showToast('Profile updated.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const passwordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: PasswordForm) =>
      authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: async (result) => {
      passwordForm.reset()
      showToast(result.message, 'success')
      await logout()
      navigate('/login', { replace: true })
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
        <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} noValidate>
          <label htmlFor="profile-email" className="space-y-2 text-sm font-medium">Email<Input id="profile-email" type="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email?.message} /></label>
          <label htmlFor="profile-name" className="space-y-2 text-sm font-medium">Name<Input id="profile-name" {...form.register('name')} error={form.formState.errors.name?.message} /></label>
          <label htmlFor="profile-currency" className="space-y-2 text-sm font-medium">Currency code<Input id="profile-currency" maxLength={3} {...form.register('preferredCurrency')} error={form.formState.errors.preferredCurrency?.message} /></label>
          <label htmlFor="profile-timezone" className="space-y-2 text-sm font-medium">Timezone<Input id="profile-timezone" {...form.register('timezone')} error={form.formState.errors.timezone?.message} /></label>
          <label htmlFor="profile-theme" className="space-y-2 text-sm font-medium">Theme<select id="profile-theme" className={fieldClass} {...form.register('theme')}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <div className="sm:col-span-2"><Button type="submit" disabled={saveMutation.isPending}><Save className="h-4 w-4" />{saveMutation.isPending ? 'Saving…' : 'Save profile'}</Button></div>
        </form>
      </Card>
      <Card className="p-5 sm:p-7">
        <h3 className="font-semibold">Change password</h3>
        <p className="mt-1 text-sm text-[var(--secondary)]">You’ll need to sign in again after changing it.</p>
        <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={passwordForm.handleSubmit((values) => passwordMutation.mutate(values))} noValidate>
          <label htmlFor="current-password" className="space-y-2 text-sm font-medium">Current password<Input id="current-password" type="password" autoComplete="current-password" {...passwordForm.register('currentPassword')} error={passwordForm.formState.errors.currentPassword?.message} /></label>
          <div className="hidden sm:block" />
          <label htmlFor="new-password" className="space-y-2 text-sm font-medium">New password<Input id="new-password" type="password" autoComplete="new-password" {...passwordForm.register('newPassword')} error={passwordForm.formState.errors.newPassword?.message} /></label>
          <label htmlFor="confirm-password" className="space-y-2 text-sm font-medium">Confirm new password<Input id="confirm-password" type="password" autoComplete="new-password" {...passwordForm.register('confirmPassword')} error={passwordForm.formState.errors.confirmPassword?.message} /></label>
          <div className="sm:col-span-2"><Button type="submit" disabled={passwordMutation.isPending}><Save className="h-4 w-4" />{passwordMutation.isPending ? 'Updating…' : 'Update password'}</Button></div>
        </form>
      </Card>
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div><h3 className="font-semibold">Sign out</h3><p className="mt-1 text-sm text-[var(--secondary)]">End this session on this device.</p></div>
        <Button variant="outline" onClick={signOut}><LogOut className="h-4 w-4" />Sign out</Button>
      </Card>
    </div>
  )
}