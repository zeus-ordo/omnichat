import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { Send, User, Bot } from 'lucide-react'
import { useLanguageStore } from '../store/language'

export default function Conversations() {
  const { id } = useParams()
  const [conversations, setConversations] = useState<any[]>([])
  const [currentConversation, setCurrentConversation] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const { t } = useLanguageStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (id) {
      loadConversation(id)
    }
  }, [id])

  const loadConversations = async () => {
    try {
      const response = await api.get('/conversations')
      setConversations(response.data.data || [])
    } catch (error) {
      console.error('Failed to load conversations', error)
    } finally {
      setLoading(false)
    }
  }

  const loadConversation = async (conversationId: string) => {
    try {
      const response = await api.get(`/conversations/${conversationId}`)
      setCurrentConversation(response.data)
      setMessages(response.data.messages || [])
    } catch (error) {
      console.error('Failed to load conversation', error)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentConversation) return
    try {
      const response = await api.post(`/conversations/${currentConversation.id}/messages`, {
        content: newMessage,
      })
      setMessages([...messages, response.data.message])
      setNewMessage('')
    } catch (error) {
      console.error('Failed to send message', error)
    }
  }

  const filteredConversations = conversations.filter((conv: any) => {
    if (statusFilter && conv.status !== statusFilter) return false
    return true
  })

  return (
    <div className="h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] p-3 sm:p-4 md:p-8">
      <div className="h-full flex flex-col md:flex-row bg-white rounded-apple-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Conversations List */}
      <div className="w-full md:w-80 md:min-w-[320px] border-r border-gray-200 bg-white flex flex-col max-h-[38vh] md:max-h-none">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold">{t('conversations') || 'Conversations'}</h1>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">{t('allStatus')}</option>
            <option value="active">{t('activeLabel')}</option>
            <option value="closed">{t('closed')}</option>
          </select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">{t('loading') || 'Loading...'}</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">{t('noData') || 'No conversations'}</div>
          ) : (
            filteredConversations.map((conversation: any) => (
              <div
                key={conversation.id}
                className={`p-4 border-b border-gray-100 cursor-pointer interactive-row ${
                  currentConversation?.id === conversation.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => loadConversation(conversation.id)}
              >
                <div className="font-medium">{conversation.channel || t('conversationLabel')}</div>
                <div className="text-sm text-gray-500 truncate">
                  {conversation.metadata?.lastMessage || t('noMessagesYet')}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(conversation.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {currentConversation ? (
          <>
            <div className="p-4 border-b border-gray-200 bg-white">
              <h2 className="font-semibold">
                {currentConversation.channel || t('conversationLabel')} - {currentConversation.status}
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
              {messages.map((message: any, index: number) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[86%] sm:max-w-[70%] rounded-lg p-2.5 sm:p-3 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {message.role === 'assistant' && <Bot size={16} className="mt-1" />}
                      {message.role === 'user' && <User size={16} className="mt-1" />}
                      <div>{message.content}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 sm:p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={t('typeMessage')}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                />
                <button
                  onClick={sendMessage}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            {t('selectConversationToStartChatting')}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
