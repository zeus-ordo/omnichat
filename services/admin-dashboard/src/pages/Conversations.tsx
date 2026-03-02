import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
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
      const [convResponse, messagesResponse] = await Promise.all([
        api.get(`/conversations/${conversationId}`),
        api.get(`/messages/conversation/${conversationId}`)
      ])
      setCurrentConversation(convResponse.data)
      setMessages(messagesResponse.data || [])
    } catch (error) {
      console.error('Failed to load conversation', error)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !id) return

    try {
      const response = await api.post(`/conversations/${id}/messages`, {
        content: newMessage,
      })
      setMessages([...messages, response.data.message])
      setNewMessage('')
    } catch (error) {
      console.error('Failed to send message', error)
    }
  }

  return (
    <div className="h-[calc(100vh-2rem)] flex">
      {/* Conversations List */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold">Conversations</h1>
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No conversations yet</div>
          ) : (
            conversations.map((conv) => (
              <Link
                key={conv.id}
                to={`/conversations/${conv.id}`}
                className={`block p-4 border-b border-gray-100 hover:bg-gray-50 ${
                  id === conv.id ? 'bg-primary-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <User size={20} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {conv.channel_user_id || 'Anonymous'}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {conv.metadata?.last_message || 'No messages'}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    conv.status === 'active' 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {conv.status}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {id ? (
          <>
            <div className="p-4 border-b border-gray-200 bg-white">
              <h2 className="font-semibold">
                Conversation with {currentConversation?.channel_user_id || 'User'}
              </h2>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      msg.role === 'user' ? 'bg-primary-100' : 'bg-gray-200'
                    }`}>
                      {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <div className={`max-w-md p-3 rounded-lg ${
                      msg.role === 'user' 
                        ? 'bg-primary-600 text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="input-field"
                />
                <button onClick={sendMessage} className="btn-primary">
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  )
}
