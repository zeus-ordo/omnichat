import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Broadcast, Send, Clock, CheckCircle, XCircle, Trash2, Plus, Users } from 'lucide-react'
import { useLanguageStore } from '../store/language'

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  
  // Form state
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [channel, setChannel] = useState('all')
  const [scheduledAt, setScheduledAt] = useState('')
  const [sending, setSending] = useState(false)
  
  const { t } = useLanguageStore()

  useEffect(() => {
    loadBroadcasts()
  }, [statusFilter])

  const loadBroadcasts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      
      const response = await api.get(`/broadcasts?${params.toString()}`)
      setBroadcasts(response.data.data || [])
    } catch (error) {
      console.error('Failed to load broadcasts', error)
    } finally {
      setLoading(false)
    }
  }

  const createBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
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
    }
  }

  const sendBroadcast = async (id: string) => {
    if (!confirm('Are you sure you want to send this broadcast now?')) return
    
    setSending(true)
    try {
      await api.post(`/broadcasts/${id}/send`)
      loadBroadcasts()
    } catch (error) {
      console.error('Failed to send broadcast', error)
    } finally {
      setSending(false)
    }
  }

  const cancelBroadcast = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this broadcast?')) return
    
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">Draft</span>
      case 'scheduled':
        return <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600">Scheduled</span>
      case 'sent':
        return <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-600">Sent</span>
      case 'cancelled':
        return <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-600">Cancelled</span>
      default:
        return <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{status}</span>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Broadcast className="w-4 h-4 text-gray-500" />
      case 'scheduled': return <Clock className="w-4 h-4 text-blue-500" />
      case 'sent': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-500" />
      default: return <Broadcast className="w-4 h-4" />
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('broadcasts') || 'Broadcasts'}</h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          {t('create_broadcast') || 'Create Broadcast'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="sent">Sent</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Broadcasts List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : broadcasts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No broadcasts found</div>
      ) : (
        <div className="space-y-4">
          {broadcasts.map((broadcast) => (
            <div
              key={broadcast.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getStatusIcon(broadcast.status)}
                  <div>
                    <h3 className="font-semibold text-lg">{broadcast.subject}</h3>
                    <p className="text-gray-600 text-sm mt-1 line-clamp-2">{broadcast.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span>Channel: {broadcast.channel}</span>
                      <span>Created: {new Date(broadcast.created_at).toLocaleDateString()}</span>
                      {broadcast.sent_at && (
                        <span>Sent: {new Date(broadcast.sent_at).toLocaleDateString()}</span>
                      )}
                      {broadcast.recipient_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Users size={14} />
                          {broadcast.recipient_count} recipients
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {getStatusBadge(broadcast.status)}
                </div>
              </div>

              {/* Actions */}
              {(broadcast.status === 'draft' || broadcast.status === 'scheduled') && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => sendBroadcast(broadcast.id)}
                    disabled={sending}
                    className="text-sm text-green-600 hover:text-green-800 flex items-center gap-1"
                  >
                    <Send size={14} />
                    Send Now
                  </button>
                  {broadcast.status === 'scheduled' && (
                    <button
                      onClick={() => cancelBroadcast(broadcast.id)}
                      className="text-sm text-yellow-600 hover:text-yellow-800"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={() => deleteBroadcast(broadcast.id)}
                    className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Broadcast Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{t('create_broadcast') || 'Create New Broadcast'}</h2>
            <form onSubmit={createBroadcast}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input-field w-full"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Message Content</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="input-field w-full h-32"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Channel</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="all">All Channels</option>
                  <option value="web">Web</option>
                  <option value="line">LINE</option>
                  <option value="facebook">Facebook</option>
                  <option value="api">API</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Schedule (Optional)</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
