import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useLanguageStore } from '../store/language'
import { Key, Plus, Trash2, Copy, Check, X, Clock } from 'lucide-react'

interface ApiKey {
  id: string
  name: string
  api_key?: string
  last_used_at: string | null
  expires_at: string | null
  created_at: string
}

export default function ApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '', expires_at: '' })
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { t } = useLanguageStore()

  useEffect(() => {
    loadApiKeys()
  }, [])

  const loadApiKeys = async () => {
    try {
      const response = await api.get('/api-keys')
      setApiKeys(response.data || [])
    } catch (error) {
      console.error('Failed to load API keys', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await api.post('/api-keys', {
        name: formData.name,
        expires_at: formData.expires_at || null,
      })
      setNewKey(response.data.api_key)
      setShowModal(false)
      setFormData({ name: '', expires_at: '' })
      loadApiKeys()
    } catch (error: any) {
      alert(error.response?.data?.message || '建立失敗')
    }
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('確定要撤銷此 API Key 嗎？此操作無法復原。')) return
    try {
      await api.delete(`/api-keys/${id}`)
      loadApiKeys()
    } catch (error) {
      alert('撤銷失敗')
    }
  }

  const copyToClipboard = async (key: string, id: string) => {
    await navigator.clipboard.writeText(key)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">API Keys</h1>
          <p className="text-gray-500 mt-1">{t('manageApiKeys') || '管理 API 金鑰用於第三方整合'}</p>
        </div>
        <button
          onClick={() => { setFormData({ name: '', expires_at: '' }); setShowModal(true) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          {t('createApiKey') || '建立 API Key'}
        </button>
      </div>

      {/* New Key Alert */}
      {newKey && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-apple-xl">
          <div className="flex items-start gap-3">
            <Check className="text-green-600 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-medium text-green-800">{t('apiKeyCreated') || 'API Key 建立成功'}</h3>
              <p className="text-sm text-green-700 mt-1">
                {t('copyApiKeyNotice') || '請立即複製並妥善保存，此 Key 之後將無法再次查看。'}
              </p>
              <div className="mt-3 flex gap-2">
                <code className="flex-1 p-2 bg-white border border-green-300 rounded text-sm font-mono break-all">
                  {newKey}
                </code>
                <button
                  onClick={() => copyToClipboard(newKey, 'new')}
                  className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  {copiedId === 'new' ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>
            <button onClick={() => setNewKey(null)} className="text-green-600 hover:bg-green-100 p-1 rounded">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">載入中...</div>
      ) : (
        <div className="bg-white rounded-apple-xl shadow-apple-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('name') || '名稱'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">API Key</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('lastUsed') || '最後使用'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('expiresAt') || '過期時間'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('createdAt') || '建立時間'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('actions') || '操作'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {apiKeys.map((keyItem) => (
                <tr key={keyItem.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Key size={18} className="text-gray-400" />
                      <span className="font-medium text-gray-900">{keyItem.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-sm text-gray-500 font-mono">••••••••••••••••••••••••</code>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {keyItem.last_used_at ? new Date(keyItem.last_used_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {keyItem.expires_at ? new Date(keyItem.expires_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(keyItem.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleRevoke(keyItem.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {apiKeys.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {t('noApiKeys') || '尚無 API Keys'}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-apple-xl shadow-apple-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">{t('createApiKey') || '建立 API Key'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('name') || '名稱'}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：Production API"
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('expiresAt') || '過期時間'} ({t('optional') || '可選'})</label>
                <input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  {t('cancel') || '取消'}
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {t('create') || '建立'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
