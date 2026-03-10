import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Language, translations } from '../lib/i18n'

interface LanguageState {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, params?: Record<string, string>) => string
}

const normalizeLanguage = (value: string | undefined): Language => {
  if (!value) return 'zh-TW'
  if (value === 'zh' || value === 'zh-TW' || value === 'zh-Hant') return 'zh-TW'
  if (value === 'en' || value === 'en-US' || value === 'en-GB') return 'en'
  if (value === 'ja' || value === 'ja-JP') return 'ja'
  if (value === 'es' || value === 'es-ES' || value === 'es-MX') return 'es'
  return 'zh-TW'
}

const createTranslator = (lang: Language) => {
  return (key: string, params?: Record<string, string>): string => {
    const langTranslations = translations[lang] || translations.en
    let text = (langTranslations as any)[key] || (translations.en as any)[key] || key

    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), value)
      })
    }

    return text
  }
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'zh-TW',
      setLanguage: (lang: Language) => {
        const normalized = normalizeLanguage(lang)
        set({ language: normalized, t: createTranslator(normalized) })
      },
      t: createTranslator('zh-TW'),
    }),
    {
      name: 'omnibot-language',
      version: 2,
      migrate: (persistedState: any) => {
        const normalized = normalizeLanguage(persistedState?.language)
        return {
          ...persistedState,
          language: normalized,
          t: createTranslator(normalized),
        }
      },
    },
  ),
)
