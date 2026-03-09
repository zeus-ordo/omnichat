import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Radio, Send, Clock, CheckCircle, XCircle, Trash2, Plus, Users } from 'lucide-react'
import { useLanguageStore } from '../store/language'

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [channel, setChannel] = useState('all')
  const [scheduledAt, setScheduledAt] = useState('')
  const [sending, setSending] = useState(false)
  
  const { t } = useLanguageStore()

  useEffect(() => {
    loadBroadcasts()
  }, [])

  const loadBroadcasts = async () => {
    try {
      const response = await api.get('/broadcasts')
      setBroadcasts(response.data.data || [])
    } catch (error) {
      console.error('Failed to load broadcasts', error)
    } finally {
      setLoading(false)
    }
  }

  const createBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    try {
      await api.post('/broadcasts', {
        subject,
        content,
        channel,
        scheduled_at: scheduledAt || null,
      })
      setShowModal(false)
      setSubject('')
      setContent('')
      setChannel('all')
      setScheduledAt('')
      loadBroadcasts()
    } catch (error) {
      console.error('Failed to create broadcast', error)
    } finally {
      setSending(false)
    }
  }

  const sendBroadcast = async (id: string) => {
    try {
      await api.post(`/broadcasts/${id}/send`)
      loadBroadcasts()
    } catch (error) {
      console.error('Failed to send broadcast', error)
    }
  }

  const cancelBroadcast = async (id: string) => {
    try {
      await api.post(`/broadcasts/${id}/cancel`)
      loadBroadcasts()
    } catch (error) {
      console.error('Failed to cancel broadcast', error)
    }
  }

  const deleteBroadcast = async (id: string) => {
    if (!confirm('Are you sure you want to delete this broadcast?')) return
    try {
      await api.delete(`/broadcasts/${id}`)
      loadBroadcasts()
    } catch (error) {
      console.error('Failed to delete broadcast', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Radio className="w-4 h-4 text-gray-500" />
      case 'scheduled': return <Clock className="w-4 h-4 text-blue-500" />
      case 'sent': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-500" />
      default: return <Radio className="w-4 h-4" />
    }
  }

  const filteredBroadcasts = broadcasts.filter((b: any) => {
    if (statusFilter && b.status !== statusFilter) return false
    return true
  })

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('broadcasts') || 'Broadcasts'}</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          {t('createNew') || 'Create Broadcast'}
        </button>
      </div>

      <div className="mb-4 flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="sent">Sent</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">{t('loading') || 'Loading...'}</div>
      ) : filteredBroadcasts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">{t('noData') || 'No broadcasts found'}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('subject') || 'Subject'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('channel') || 'Channel'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('recipients') || 'Recipients'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBroadcasts.map((broadcast: any) => (
                <tr key={broadcast.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(broadcast.status)}
                      <span className="text-sm capitalize">{broadcast.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">{broadcast.subject}</td>
                  <td className="px-6 py-4 text-sm">{broadcast.channel || 'All'}</td>
                  <td className="px-6 py-4 text-sm">{broadcast.recipients_count || 0}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {broadcast.status === 'draft' && (
                        <button
                          onClick={() => sendBroadcast(broadcast.id)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Send"
                        >
                          <Send size={16} />
                        </button>
                      )}
                      {broadcast.status === 'scheduled' && (
                        <button
                          onClick={() => cancelBroadcast(broadcast.id)}
                          className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                          title="Cancel"
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteBroadcast(broadcast.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">{t('createNew') || 'Create New Broadcast'}</h2>
            <form onSubmit={createBroadcast}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('subject') || 'Subject'}</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('description') || 'Content'}</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('channel') || 'Channel'}</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="all">All Channels</option>
                    <option value="web">Website</option>
                    <option value="line">LINE</option>
                    <option value="facebook">Facebook</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('scheduledAt') || 'Schedule (Optional)'}</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  {t('cancel') || 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {sending ? (t('sending') || 'Sending...') : (t('save') || 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
