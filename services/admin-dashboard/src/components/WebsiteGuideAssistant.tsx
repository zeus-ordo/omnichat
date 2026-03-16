import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, MessageCircle, Send, X } from 'lucide-react'
import { api } from '../lib/api'

type AssistantMessage = {
  role: 'user' | 'assistant'
  content: string
}

type AssistantConfig = {
  prompt: string
  welcomeMessage: string
  scopeNotes: string
}

const defaultWelcome = '嗨，我是系統小助手。你可以問我網站要怎麼操作。'

export default function WebsiteGuideAssistant() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<AssistantConfig | null>(null)
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { role: 'assistant', content: defaultWelcome },
  ])
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await api.get('/ai/assistant/config')
        const nextConfig = response.data as AssistantConfig
        setConfig(nextConfig)
        const welcomeMessage = nextConfig?.welcomeMessage?.trim() || defaultWelcome
        setMessages([{ role: 'assistant', content: welcomeMessage }])
      } catch {
        setConfig(null)
      }
    }

    void loadConfig()
  }, [])

  useEffect(() => {
    if (!open || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [open, messages, loading])

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading])

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const nextMessages: AssistantMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await api.post(
        '/ai/assistant/chat',
        {
          message: text,
          history: nextMessages,
        },
        {
          timeout: 45000,
        },
      )

      const content = response.data?.content || '目前無法取得回覆，請稍後再試。'
      setMessages((prev) => [...prev, { role: 'assistant', content }])
    } catch (error: any) {
      const timeout = error?.code === 'ECONNABORTED'
      const serverMessage =
        error?.response?.data?.content ||
        error?.response?.data?.message ||
        ''
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            (typeof serverMessage === 'string' && serverMessage.trim()) ||
            (timeout ? '回覆逾時，請縮短問題或再試一次。' : '連線暫時失敗，請再試一次。'),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open ? (
        <div className="w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-blue-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot size={18} />
              <div>
                <p className="text-sm font-semibold">系統小助手</p>
                <p className="text-xs text-blue-100">網站使用導覽與功能介紹</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-blue-500 transition-colors"
              aria-label="Close assistant"
            >
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} className="h-[360px] overflow-y-auto p-4 bg-gray-50 space-y-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-6 whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-500 border border-gray-200 px-3 py-2 rounded-2xl rounded-bl-md text-sm">
                  小助手回覆中...
                </div>
              </div>
            )}
          </div>

          <form onSubmit={sendMessage} className="p-3 bg-white border-t border-gray-200">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="輸入問題，例如：怎麼建立機器人？"
                className="flex-1 px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 text-sm"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:bg-gray-300 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
            {config?.scopeNotes && (
              <p className="mt-2 text-xs text-gray-500">支援範圍：{config.scopeNotes}</p>
            )}
          </form>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 transition-colors flex items-center justify-center"
          aria-label="Open website guide assistant"
        >
          <MessageCircle size={24} />
        </button>
      )}
    </div>
  )
}
