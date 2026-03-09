import { useState } from 'react'
import { api } from '../lib/api'
import { useLanguageStore } from '../store/language'
import { Key, Copy, Check } from 'lucide-react'

export default function Settings() {
  const [apiKey, setApiKey] = useState('demo_api_key_12345')
  const [copied, setCopied] = useState(false)
  const { t } = useLanguageStore()

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('settings')}</h1>

      <div className="space-y-6 max-w-2xl">
        {/* API Key */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">{t('apiKey')}</h2>
          <p className="text-sm text-gray-500 mb-4">
            {t('useThisApiKeyToAuthenticate')}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={apiKey}
              readOnly
              className="input-field flex-1 font-mono"
            />
            <button
              onClick={copyToClipboard}
              className="btn-secondary flex items-center gap-2"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? t('copied') : t('copy')}
            </button>
          </div>
        </div>

        {/* AI Settings */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">{t('aiConfiguration')}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('defaultModel')}
              </label>
              <select className="input-field">
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('temperature')}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                defaultValue="0.7"
                className="w-full"
              />
              <p className="text-sm text-gray-500 mt-1">
                {t('controlsRandomness')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('systemPrompt')}
              </label>
              <textarea
                rows={4}
                className="input-field"
                defaultValue={t('defaultSystemPrompt')}
              />
            </div>
          </div>
        </div>

        {/* Webhooks */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">{t('webhooks')}</h2>
          <p className="text-sm text-gray-500 mb-4">
            {t('configureWebhooksToReceive')}
          </p>
          <div className="space-y-3">
            <input
              type="url"
              placeholder={t('webhookUrlPlaceholder')}
              className="input-field"
            />
            <div className="flex gap-2">
              <button className="btn-primary">{t('addWebhook')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
