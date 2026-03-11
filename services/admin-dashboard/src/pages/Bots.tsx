import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Bot,
  Settings,
  Trash2,
  Edit2,
  X,
  Brain,
  Database,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { api } from '../lib/api'
import { useLanguageStore } from '../store/language'
import ErrorModal from '../components/ErrorModal'
import { getErrorMessage } from '../lib/error'

type BotChannel = {
  id: string
  type: 'web' | 'line' | 'facebook' | 'api'
  enabled: boolean
  name: string
}

type BotItem = {
  id: string
  name: string
  model: string
  database: string
  channels: BotChannel[]
  surveys: string[]
  surveysCount: number
  documentsCount: number
  conversationsCount: number
  messagesCount: number
  lastActive: string
  isActive: boolean
  channelConfigs?: Record<string, Record<string, string>>
}

const channelConfigFields: Record<string, Array<{ key: string; label: string; placeholder: string }>> = {
  web: [
    { key: 'siteUrl', label: '網站 URL', placeholder: 'https://example.com' },
  ],
  line: [
    { key: 'channelAccessToken', label: 'Channel Access Token', placeholder: 'LINE token' },
    { key: 'channelSecret', label: 'Channel Secret', placeholder: 'LINE secret' },
  ],
  facebook: [
    { key: 'pageAccessToken', label: 'Page Access Token', placeholder: 'Facebook token' },
    { key: 'verifyToken', label: 'Verify Token', placeholder: '驗證 token' },
  ],
  api: [
    { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://example.com/webhook' },
    { key: 'bearerToken', label: 'Bearer Token', placeholder: 'API token' },
    { key: 'hmacSecret', label: 'HMAC Secret', placeholder: '簽章密鑰' },
  ],
}

type KnowledgeDoc = {
  id: string
  name: string
}

const modelOptions = [
  { value: 'GPT-4o', label: 'GPT-4o' },
  { value: 'GPT-4 Turbo', label: 'GPT-4 Turbo' },
  { value: 'Claude 3.5 Sonnet', label: 'Claude 3.5 Sonnet' },
]

const defaultChannels: BotChannel[] = [
  { id: '1', type: 'web', enabled: true, name: 'Website' },
  { id: '2', type: 'line', enabled: false, name: 'LINE' },
  { id: '3', type: 'facebook', enabled: false, name: 'Facebook' },
  { id: '4', type: 'api', enabled: false, name: 'REST API' },
]

export default function Bots() {
  const { t } = useLanguageStore()
  const [bots, setBots] = useState<BotItem[]>([])
  const [docs, setDocs] = useState<KnowledgeDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingBot, setEditingBot] = useState<BotItem | null>(null)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    model: 'GPT-4o',
    database: '',
  })

  const docMap = useMemo(() => {
    const map = new Map<string, string>()
    docs.forEach((doc) => map.set(doc.id, doc.name))
    return map
  }, [docs])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [botsRes, docsRes] = await Promise.all([
          api.get('/bots'),
          api.get('/documents'),
        ])

        setBots(Array.isArray(botsRes.data) ? botsRes.data : [])
        setDocs((docsRes.data || []).map((doc: any) => ({ id: doc.id, name: doc.name })))
      } catch (err) {
        setError(getErrorMessage(err, '讀取機器人設定失敗'))
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const persistUpdate = async (id: string, payload: Partial<BotItem>) => {
    try {
      const response = await api.put(`/bots/${id}`, payload)
      const updated = response.data as BotItem
      setBots((prev) => prev.map((item) => (item.id === id ? updated : item)))
    } catch (err) {
      setError(getErrorMessage(err, '更新機器人失敗'))
    }
  }

  const handleChannelToggle = async (bot: BotItem, channelType: string) => {
    const nextChannels = bot.channels.map((channel) =>
      channel.type === channelType ? { ...channel, enabled: !channel.enabled } : channel,
    )
    await persistUpdate(bot.id, { channels: nextChannels })
  }

  const handleKnowledgeBaseChange = async (bot: BotItem, database: string) => {
    await persistUpdate(bot.id, {
      database,
      documentsCount: database ? 1 : 0,
    })
  }

  const handleChannelConfigChange = async (
    bot: BotItem,
    channelType: string,
    key: string,
    value: string,
  ) => {
    const current = bot.channelConfigs || {}
    const next = {
      ...current,
      [channelType]: {
        ...(current[channelType] || {}),
        [key]: value,
      },
    }

    await persistUpdate(bot.id, { channelConfigs: next })
  }

  const handleCreateBot = () => {
    setEditingBot(null)
    setFormData({ name: '', model: 'GPT-4o', database: '' })
    setShowModal(true)
  }

  const handleEditBot = (bot: BotItem) => {
    setEditingBot(bot)
    setFormData({
      name: bot.name,
      model: bot.model,
      database: bot.database,
    })
    setShowModal(true)
  }

  const handleDeleteBot = async (id: string) => {
    if (!confirm(t('areYouSure'))) return

    try {
      await api.delete(`/bots/${id}`)
      setBots((prev) => prev.filter((bot) => bot.id !== id))
    } catch (err) {
      setError(getErrorMessage(err, '刪除機器人失敗'))
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)

    const payload = {
      name: formData.name,
      model: formData.model,
      database: formData.database,
      documentsCount: formData.database ? 1 : 0,
      channels: editingBot?.channels || defaultChannels,
    }

    try {
      if (editingBot) {
        const response = await api.put(`/bots/${editingBot.id}`, payload)
        const updated = response.data as BotItem
        setBots((prev) => prev.map((bot) => (bot.id === editingBot.id ? updated : bot)))
      } else {
        const response = await api.post('/bots', payload)
        setBots((prev) => [...prev, response.data as BotItem])
      }

      setShowModal(false)
    } catch (err) {
      setError(getErrorMessage(err, '儲存機器人失敗'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-shell">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-header-title">{t('bots')}</h1>
          <p className="page-header-subtitle">{t('botSettings')}</p>
        </div>
        <button onClick={handleCreateBot} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          {t('createBot')}
        </button>
      </div>

      {docs.length === 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          目前沒有可選取的知識庫文件，請先到 Knowledge Base 上傳文件。
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-500">{t('loading')}</div>
      ) : bots.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center text-gray-500">
          <Bot className="mx-auto mb-3 text-gray-300" size={40} />
          目前沒有機器人，請先建立。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bots.map((bot) => (
            <div key={bot.id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold">
                      {bot.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{bot.name}</h3>
                      <p className="text-sm text-gray-500 truncate">{bot.lastActive}</p>
                    </div>
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${bot.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Brain className="text-blue-500" size={16} />
                  <div>
                    <p className="text-xs text-gray-500">{t('aiModel')}</p>
                    <p className="text-sm font-medium text-gray-900">{bot.model}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Database className="text-purple-500" size={16} />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">知識庫</p>
                    <select
                      value={bot.database || ''}
                      onChange={(event) => void handleKnowledgeBaseChange(bot, event.target.value)}
                      className="mt-1 w-full text-sm font-medium text-gray-900 bg-transparent border border-gray-200 rounded-lg px-2 py-1"
                    >
                      <option value="">未選取</option>
                      {docs.map((doc) => (
                        <option key={doc.id} value={doc.id}>{doc.name}</option>
                      ))}
                    </select>
                    {bot.database && (
                      <p className="text-xs text-gray-400 mt-1 truncate">目前綁定：{docMap.get(bot.database) || bot.database}</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-2">{t('botChannels')}</p>
                  <div className="flex flex-wrap gap-2">
                    {bot.channels.map((channel) => (
                      <button
                        key={`${bot.id}-${channel.type}`}
                        onClick={() => void handleChannelToggle(bot, channel.type)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          channel.enabled
                            ? 'bg-green-100 text-green-700 ring-2 ring-green-500 ring-opacity-50'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {channel.enabled ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {channel.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-gray-100 p-3">
                  <p className="text-xs font-medium text-gray-600">Channel 參數（每個機器人獨立）</p>
                  {bot.channels
                    .filter((channel) => channel.enabled)
                    .map((channel) => (
                      <div key={`${bot.id}-config-${channel.type}`} className="space-y-2">
                        <p className="text-xs text-gray-500">{channel.name}</p>
                        {(channelConfigFields[channel.type] || []).map((field) => (
                          <input
                            key={`${channel.type}-${field.key}`}
                            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                            placeholder={field.placeholder}
                            defaultValue={bot.channelConfigs?.[channel.type]?.[field.key] || ''}
                            onBlur={(event) =>
                              void handleChannelConfigChange(
                                bot,
                                channel.type,
                                field.key,
                                event.currentTarget.value,
                              )
                            }
                          />
                        ))}
                        {channel.type === 'api' && (
                          <p className="text-[11px] text-gray-400">
                            Webhook 入口：<code>/api/bots/{bot.id}/webhook</code>，請求需帶 x-api-key、Bearer token、x-timestamp、x-signature。
                          </p>
                        )}
                      </div>
                    ))}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 text-center">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{bot.conversationsCount}</p>
                    <p className="text-xs text-gray-500">{t('botConversations')}</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{bot.messagesCount}</p>
                    <p className="text-xs text-gray-500">{t('botMessages')}</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{bot.documentsCount}</p>
                    <p className="text-xs text-gray-500">知識庫</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 bg-gray-50 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleEditBot(bot)}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  title={t('edit')}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => void handleDeleteBot(bot.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title={t('delete')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="modal-title">{editingBot ? t('editBot') : t('createBot')}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('botName')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('aiModel')}</label>
                <select
                  value={formData.model}
                  onChange={(event) => setFormData({ ...formData, model: event.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">知識庫</label>
                <select
                  value={formData.database}
                  onChange={(event) => setFormData({ ...formData, database: event.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">未選取</option>
                  {docs.map((doc) => (
                    <option key={doc.id} value={doc.id}>{doc.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? '儲存中...' : editingBot ? t('save') : t('createBot')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ErrorModal
        open={Boolean(error)}
        title="機器人設定失敗"
        message={error}
        onClose={() => setError('')}
      />
    </div>
  )
}
