import { useLanguageStore } from '../store/language'
import { Language } from '../lib/i18n'
import { Globe } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

const languages: { code: Language; name: string; flag: string }[] = [
  { code: 'zh-TW', name: '中文', flag: '🇹🇼' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
]

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguageStore()
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentLang = languages.find(l => l.code === language) || languages[0]

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && 
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleDropdown = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      // Show dropdown ABOVE the button
      setPosition({
        top: rect.top - 4,
        left: rect.left
      })
    }
    setIsOpen(!isOpen)
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors w-full justify-start"
        title="Switch Language"
      >
        <Globe size={16} />
        <span className="text-xs">{currentLang.flag}</span>
        <span className="text-xs">{currentLang.name}</span>
      </button>

      {isOpen && (
        <div 
          ref={dropdownRef}
          className="fixed bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-[100]"
          style={{ 
            top: position.top, 
            left: position.left,
            minWidth: '140px'
          }}
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code)
                setIsOpen(false)
              }}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                language === lang.code ? 'bg-primary-50 text-primary-600' : 'text-gray-700'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
