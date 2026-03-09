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
      
      setLanguage: (lang: Language) => set({ language: lang }),
      
      t: (key: string, params?: Record<string, string>): string => {
        const currentLang = get().language
        const langTranslations = translations[currentLang] || translations['en']
        let text = (langTranslations as any)[key] 
          || (translations['en'] as any)[key] 
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
