import { useLanguageStore } from '../store/language'

export default function MessageTemplates() {
  const { t } = useLanguageStore()
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        {t('messageTemplates') || 'Message Templates'}
      </h1>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-500">{t('loading') || 'Loading...'}</p>
      </div>
    </div>
  )
}
