import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useLanguageStore } from '../store/language'
import { AlertTriangle, Check, Copy, ShieldCheck, ShieldX } from 'lucide-react'
import { useAuthStore } from '../store/auth'

type AssistantConfig = {
  prompt: string
  welcomeMessage: string
  scopeNotes: string
}

type AssistantActionHistoryItem = {
  id: string
  action_type: string
  status: string
  error_message?: string | null
  phase?: 'phase1' | 'phase2' | string
  scope?: 'user' | 'tenant' | string
  risk_level?: 'low' | 'medium' | 'high' | string
  requires_confirmation?: boolean
  created_at: string
  expires_at?: string
}

const maskApiKeyDisplay = (key: string) => {
  if (!key) return ''
  if (key.length <= 8) return '********'
  return `${key.slice(0, 4)}${'*'.repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`
}

const maskSecretText = (text: string) =>
  text
    .replace(/(Bearer\s+)([A-Za-z0-9._~+\/-]{8,})/gi, '$1******')
    .replace(
      /(api[_\s-]?key|access[_\s-]?token|channel[_\s-]?secret|password|secret|token)\s*([:=：])\s*([^\s,;]+)/gi,
      '$1$2 ******',
    )

const actionStatusMeta: Record<string, { label: string; className: string }> = {
  pending: { label: '待確認', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  confirmed: { label: '已確認', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  completed: { label: '已完成', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  expired: { label: '已逾期', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  cancelled: { label: '已取消', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  failed: { label: '執行失敗', className: 'bg-red-100 text-red-700 border border-red-200' },
}

const riskMeta: Record<string, { label: string; className: string }> = {
  low: { label: '低風險', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  medium: { label: '中風險', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  high: { label: '高風險', className: 'bg-red-100 text-red-700 border border-red-200' },
}

const actionTypeLabel: Record<string, string> = {
  get_my_profile: '讀取我的帳號資料',
  update_my_display_name: '更新顯示名稱',
  update_my_language: '更新語系設定',
  update_my_notification_pref: '更新通知設定',
  tenant_bot_channel_toggle: '切換 Bot Channel 啟用狀態',
  tenant_bot_channel_config_update: '更新 Bot Channel 設定',
  tenant_assistant_config_update: '更新系統小助手設定',
  tenant_kb_binding_update: '更新知識庫綁定',
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
  const [actionHistory, setActionHistory] = useState<AssistantActionHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const { user } = useAuthStore()
  const { t } = useLanguageStore()
  const maskedApiKey = useMemo(() => maskApiKeyDisplay(apiKey), [apiKey])
  const historySummary = useMemo(
    () =>
      actionHistory.reduce(
        (acc, item) => {
          const status = item.status || 'pending'
          if (status === 'pending') acc.pending += 1
          else if (status === 'confirmed' || status === 'completed') acc.completed += 1
          else if (status === 'failed' || status === 'cancelled' || status === 'expired') acc.failed += 1
          return acc
        },
        { pending: 0, completed: 0, failed: 0 },
      ),
    [actionHistory],
  )

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

  useEffect(() => {
    const loadActionHistory = async () => {
      setHistoryLoading(true)
      try {
        const response = await api.get('/ai/assistant/actions/history')
        setActionHistory(Array.isArray(response.data) ? response.data : [])
      } catch {
        setActionHistory([])
      } finally {
        setHistoryLoading(false)
      }
    }

    void loadActionHistory()
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

      <div className="space-y-6 max-w-2xl w-full">
        {/* API Key */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">{t('apiKey')}</h2>
          <p className="text-sm text-gray-500 mb-4">
            {t('useThisApiKeyToAuthenticate')}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={maskedApiKey}
              readOnly
              className="input-field flex-1 font-mono min-w-0"
            />
            <button
              onClick={copyToClipboard}
              className="btn-secondary flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? t('copied') : t('copy')}
            </button>
          </div>
          <p className="text-xs text-amber-600 mt-2">顯示值已遮罩。複製按鈕會複製完整 API Key，請避免在聊天與截圖中外洩。</p>
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

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary">{t('addWebhook')}</button>
            </div>
          </div>
        </div>

        {/* Assistant Action History */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">聊天操作紀錄（Phase 2）</h2>
          <p className="text-sm text-gray-500 mb-4">
            追蹤待確認、風險等級與最終狀態，避免高風險操作在無確認下執行。
          </p>

          <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-700">待確認</p>
              <p className="text-lg font-semibold text-amber-900">{historySummary.pending}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700">已完成</p>
              <p className="text-lg font-semibold text-emerald-900">{historySummary.completed}</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-700">異常 / 取消</p>
              <p className="text-lg font-semibold text-red-900">{historySummary.failed}</p>
            </div>
          </div>

          {historyLoading ? (
            <p className="text-sm text-gray-500">載入中...</p>
          ) : actionHistory.length === 0 ? (
            <p className="text-sm text-gray-500">目前尚無操作紀錄。</p>
          ) : (
            <div className="space-y-2">
              {actionHistory.slice(0, 10).map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {actionTypeLabel[item.action_type] || item.action_type}
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full ${
                          (actionStatusMeta[item.status] || actionStatusMeta.pending).className
                        }`}
                      >
                        {(actionStatusMeta[item.status] || actionStatusMeta.pending).label}
                      </span>
                      {item.risk_level && (
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full ${
                            (riskMeta[item.risk_level] || riskMeta.medium).className
                          }`}
                        >
                          {(riskMeta[item.risk_level] || riskMeta.medium).label}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 mt-1">
                    建立時間：{new Date(item.created_at).toLocaleString()} ・ 範圍：{item.scope || 'user'} ・
                    階段：{item.phase || 'phase1'}
                  </p>

                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {item.requires_confirmation === false ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <ShieldCheck size={14} /> 無需二次確認
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <AlertTriangle size={14} /> 需二次確認
                      </span>
                    )}
                    {(item.status || '').toLowerCase() === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <ShieldX size={14} /> 尚未執行
                      </span>
                    )}
                  </div>

                  {item.expires_at && (
                    <p className="text-xs text-gray-500 mt-1">確認逾期時間：{new Date(item.expires_at).toLocaleString()}</p>
                  )}

                  {item.error_message && (
                    <p className="text-xs text-red-600 mt-1">錯誤：{maskSecretText(item.error_message)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
