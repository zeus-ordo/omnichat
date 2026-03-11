import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useLanguageStore } from '../store/language'
import { Key, Copy, Check } from 'lucide-react'
import { useAuthStore } from '../store/auth'

type AssistantConfig = {
  prompt: string
  welcomeMessage: string
  scopeNotes: string
}

export default function Settings() {
  const [apiKey, setApiKey] = useState('demo_api_key_12345')
  const [copied, setCopied] = useState(false)
  const [assistantConfig, setAssistantConfig] = useState<AssistantConfig>({
    prompt: '',
    welcomeMessage: '',
    scopeNotes: '',
  })
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantSaving, setAssistantSaving] = useState(false)
  const [assistantNotice, setAssistantNotice] = useState('')
  const { user } = useAuthStore()
  const { t } = useLanguageStore()

  useEffect(() => {
    const loadAssistantConfig = async () => {
      setAssistantLoading(true)
      setAssistantNotice('')
      try {
        const response = await api.get('/ai/assistant/config')
        const data = response.data as AssistantConfig
        setAssistantConfig({
          prompt: data?.prompt || '',
          welcomeMessage: data?.welcomeMessage || '',
          scopeNotes: data?.scopeNotes || '',
        })
      } catch {
        setAssistantNotice('無法讀取系統小助手設定，請稍後再試。')
      } finally {
        setAssistantLoading(false)
      }
    }

    void loadAssistantConfig()
  }, [])

  const canManageAssistant = user?.role === 'owner' || user?.role === 'admin'

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const saveAssistantConfig = async () => {
    if (!canManageAssistant) {
      setAssistantNotice('只有 owner/admin 可以修改系統小助手設定。')
      return
    }

    setAssistantSaving(true)
    setAssistantNotice('')
    try {
      await api.put('/ai/assistant/config', assistantConfig)
      setAssistantNotice('已儲存系統小助手設定。')
    } catch {
      setAssistantNotice('儲存失敗，請稍後再試。')
    } finally {
      setAssistantSaving(false)
    }
  }

  return (
    <div className="page-shell">
      <h1 className="page-header-title mb-8">{t('settings')}</h1>

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

        {/* Website Guide Assistant Settings */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">系統小助手設定</h2>
          <p className="text-sm text-gray-500 mb-4">
            控制右下角導覽 chatbot 的回覆邏輯與歡迎文字。此設定只會影響目前租戶。
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">導覽系統提示詞</label>
              <textarea
                rows={5}
                className="input-field"
                value={assistantConfig.prompt}
                onChange={(event) =>
                  setAssistantConfig((prev) => ({ ...prev, prompt: event.target.value }))
                }
                disabled={assistantLoading || !canManageAssistant}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">歡迎訊息</label>
              <textarea
                rows={3}
                className="input-field"
                value={assistantConfig.welcomeMessage}
                onChange={(event) =>
                  setAssistantConfig((prev) => ({ ...prev, welcomeMessage: event.target.value }))
                }
                disabled={assistantLoading || !canManageAssistant}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">導覽範圍提示</label>
              <input
                className="input-field"
                value={assistantConfig.scopeNotes}
                onChange={(event) =>
                  setAssistantConfig((prev) => ({ ...prev, scopeNotes: event.target.value }))
                }
                disabled={assistantLoading || !canManageAssistant}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={saveAssistantConfig}
                disabled={assistantSaving || assistantLoading || !canManageAssistant}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assistantSaving ? '儲存中...' : '儲存小助手設定'}
              </button>

              {!canManageAssistant && (
                <p className="text-xs text-amber-600">目前帳號非 owner/admin，僅可檢視。</p>
              )}
            </div>

            {assistantNotice && <p className="text-sm text-gray-600">{assistantNotice}</p>}
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
