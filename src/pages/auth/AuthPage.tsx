import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, WalletCards } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'

const authSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type AuthValues = z.infer<typeof authSchema>

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { isAuthenticated, login, register } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const isRegister = mode === 'register'
  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  async function submit(values: AuthValues) {
    if (isRegister && (values.name?.trim().length ?? 0) < 2) {
      form.setError('name', { message: 'Name must be at least 2 characters' })
      return
    }
    if (isRegister && values.password.length < 8) {
      form.setError('password', { message: 'Password must be at least 8 characters' })
      return
    }
    try {
      if (isRegister) {
        await register({ name: values.name!.trim(), email: values.email, password: values.password })
      } else {
        await login({ email: values.email, password: values.password })
      }
      showToast(isRegister ? 'Account created.' : 'Welcome back.', 'success')
      navigate('/dashboard', { replace: true })
    } catch (error) {
      showToast(getErrorMessage(error), 'error')
    }
  }

  return (
    <main className="grid min-h-dvh bg-[var(--background)] lg:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
      <section className="relative hidden overflow-hidden bg-[#102e28] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(#9cc3a4 0.7px, transparent 0.7px)', backgroundSize: '22px 22px' }} />
        <div className="relative flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#c4f06a] text-[#102e28]"><WalletCards className="h-5 w-5" /></div>
          <span className="text-lg font-semibold">SpendWise</span>
        </div>
        <div className="relative max-w-xl pb-16">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#c4f06a]">Your money, in focus</p>
          <h1 className="max-w-lg text-5xl font-semibold leading-[1.08]">Make every rupee feel accounted for.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/70">One clear view of spending, saving, lending, and the balances that matter.</p>
        </div>
        <p className="relative text-xs text-white/50">Private by design. Built for your everyday finances.</p>
      </section>

      <section className="flex min-h-dvh items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#102e28] text-[#c4f06a]"><WalletCards className="h-5 w-5" /></div>
            <span className="text-lg font-semibold">SpendWise</span>
          </div>
          <p className="text-sm font-medium text-[var(--primary)]">Welcome {isRegister ? 'to SpendWise' : 'back'}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">{isRegister ? 'Create your account' : 'Sign in'}</h2>
          <p className="mt-2 text-sm text-[var(--secondary)]">{isRegister ? 'Start with a clear picture of your finances.' : 'Pick up where you left off.'}</p>

          <form className="mt-8 space-y-5" onSubmit={form.handleSubmit(submit)} noValidate>
            {isRegister ? (
              <label className="block space-y-2 text-sm font-medium" htmlFor="name">
                Name
                <Input id="name" autoComplete="name" {...form.register('name')} error={form.formState.errors.name?.message} />
              </label>
            ) : null}
            <label className="block space-y-2 text-sm font-medium" htmlFor="email">
              Email
              <Input id="email" type="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email?.message} />
            </label>
            <label className="block space-y-2 text-sm font-medium" htmlFor="password">
              Password
              <Input id="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} {...form.register('password')} error={form.formState.errors.password?.message} />
            </label>
            <Button className="w-full" size="lg" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-[var(--secondary)]">
            {isRegister ? 'Already have an account?' : 'New to SpendWise?'}{' '}
            <Link className="font-semibold text-[var(--primary)] hover:underline" to={isRegister ? '/login' : '/register'}>
              {isRegister ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}