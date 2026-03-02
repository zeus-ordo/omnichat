import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../lib/api'

interface AuthState {
  token: string | null
  user: any | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: async (email: string, password: string) => {
        const response = await api.post('/auth/login', { email, password })
        set({ 
          token: response.data.access_token, 
          user: response.data.user 
        })
      },
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'omnibot-auth',
    }
  )
)
