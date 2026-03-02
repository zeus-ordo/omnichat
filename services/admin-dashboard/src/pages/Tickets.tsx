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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('tickets') || 'Tickets'}</h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          {t('create_ticket') || 'Create Ticket'}
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
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="input-field"
        >
          <option value="">All Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Tickets List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No tickets found</div>
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
                      <span>Created: {new Date(ticket.created_at).toLocaleDateString()}</span>
                      {ticket.resolved_at && (
                        <span>Resolved: {new Date(ticket.resolved_at).toLocaleDateString()}</span>
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
                    Start Working
                  </button>
                )}
                {ticket.status === 'in_progress' && (
                  <button
                    onClick={() => updateTicketStatus(ticket.id, 'resolved')}
                    className="text-sm text-green-600 hover:text-green-800"
                  >
                    Mark Resolved
                  </button>
                )}
                {ticket.status === 'resolved' && (
                  <button
                    onClick={() => updateTicketStatus(ticket.id, 'closed')}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Close Ticket
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
            <h2 className="text-xl font-bold mb-4">{t('create_ticket') || 'Create New Ticket'}</h2>
            <form onSubmit={createTicket}>
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
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field w-full h-24"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
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
