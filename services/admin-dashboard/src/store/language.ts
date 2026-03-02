import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Language, translations } from '../lib/i18n'

interface LanguageState {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, params?: Record<string, string>) => string
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'zh-TW',
      
      setLanguage: (language: Language) => set({ language }),
      
      t: (key: string, params?: Record<string, string>): string => {
        const { language } = get()
        let text = translations[language]?.[key as keyof typeof translations['en']] 
          || translations['en'][key as keyof typeof translations['en']] 
          || key
        
        // Replace parameters like {name} with actual values
        if (params) {
          Object.entries(params).forEach(([paramKey, value]) => {
            text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), value)
          })
        }
        
        return text
      }
    }),
    {
      name: 'omnibot-language',
    }
  )
)
