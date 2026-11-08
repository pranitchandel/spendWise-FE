import { api, clearTokens, setTokens, unwrap } from './client'
import type { AuthTokens, User } from '@/types'

export interface RegisterInput {
  name: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export const authApi = {
  async register(input: RegisterInput) {
    const data = await unwrap(api.post('/auth/register', input))
    const tokens = data as AuthTokens
    setTokens(tokens.accessToken, tokens.refreshToken)
    return tokens
  },

  async login(input: LoginInput) {
    const data = await unwrap(api.post('/auth/login', input))
    const tokens = data as AuthTokens
    setTokens(tokens.accessToken, tokens.refreshToken)
    return tokens
  },

  async logout() {
    try {
      await api.post('/auth/logout')
    } finally {
      clearTokens()
    }
  },

  async me() {
    return unwrap<User>(api.get('/users/me'))
  },

  async updateProfile(input: Partial<Pick<User, 'email' | 'name' | 'theme' | 'preferredCurrency' | 'timezone'>>) {
    return unwrap<User>(api.put('/users/me', input))
  },

  async changePassword(input: { currentPassword: string; newPassword: string }) {
    return unwrap<{ message: string }>(api.post('/users/me/password', input))
  },
}
