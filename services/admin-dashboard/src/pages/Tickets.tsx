import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Ticket, User, Clock, CheckCircle, XCircle, AlertCircle, Plus, Search } from 'lucide-react'
import { useLanguageStore } from '../store/language'

export default function Tickets() {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  
  // Form state
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  
  const { t } = useLanguageStore()

  useEffect(() => {
    loadTickets()
  }, [statusFilter, priorityFilter])

  const loadTickets = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      if (priorityFilter) params.append('priority', priorityFilter)
      
      const response = await api.get(`/tickets?${params.toString()}`)
      setTickets(response.data.data || [])
    } catch (error) {
      console.error('Failed to load tickets', error)
    } finally {
      setLoading(false)
    }
  }

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/tickets', {
        subject,
        description,
        priority,
      })
      setShowModal(false)
      setSubject('')
      setDescription('')
      setPriority('medium')
      loadTickets()
    } catch (error) {
      console.error('Failed to create ticket', error)
    }
  }

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      await api.put(`/tickets/${ticketId}`, { status })
      loadTickets()
    } catch (error) {
      console.error('Failed to update ticket', error)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'in_progress': return <Clock className="w-4 h-4 text-yellow-500" />
      case 'resolved': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'closed': return <XCircle className="w-4 h-4 text-gray-500" />
      default: return <Ticket className="w-4 h-4" />
    }
  }

  return (
    <div className="page-shell">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="page-header-title">{t('tickets') || 'Tickets'}</h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          {t('createTicket')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-full sm:w-56"
        >
          <option value="">{t('allStatus')}</option>
          <option value="open">{t('open')}</option>
          <option value="in_progress">{t('inProgress')}</option>
          <option value="resolved">{t('resolved')}</option>
          <option value="closed">{t('closed')}</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="input-field w-full sm:w-56"
        >
          <option value="">{t('allPriority')}</option>
          <option value="high">{t('high')}</option>
          <option value="medium">{t('medium')}</option>
          <option value="low">{t('low')}</option>
        </select>
      </div>

      {/* Tickets List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">{t('loading')}</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-8 text-gray-500">{t('noTicketsFound')}</div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getStatusIcon(ticket.status)}
                  <div>
                    <h3 className="font-semibold text-lg">{ticket.subject}</h3>
                    <p className="text-gray-600 text-sm mt-1">{ticket.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span>{t('createdLabel')}: {new Date(ticket.created_at).toLocaleDateString()}</span>
                      {ticket.resolved_at && (
                        <span>{t('resolvedLabel')}: {new Date(ticket.resolved_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority?.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">{ticket.status?.replace('_', ' ')}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                {ticket.status === 'open' && (
                  <button
                    onClick={() => updateTicketStatus(ticket.id, 'in_progress')}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {t('startWorking')}
                  </button>
                )}
                {ticket.status === 'in_progress' && (
                  <button
                    onClick={() => updateTicketStatus(ticket.id, 'resolved')}
                    className="text-sm text-green-600 hover:text-green-800"
                  >
                    {t('markResolved')}
                  </button>
                )}
                {ticket.status === 'resolved' && (
                  <button
                    onClick={() => updateTicketStatus(ticket.id, 'closed')}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    {t('closeTicket')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Ticket Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="modal-title mb-4">{t('createNewTicket')}</h2>
            <form onSubmit={createTicket}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">{t('subject')}</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input-field w-full"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">{t('description')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field w-full h-24"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">{t('priority')}</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="low">{t('low')}</option>
                  <option value="medium">{t('medium')}</option>
                  <option value="high">{t('high')}</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  {t('cancel')}
                </button>
                <button type="submit" className="btn-primary">
                  {t('create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
