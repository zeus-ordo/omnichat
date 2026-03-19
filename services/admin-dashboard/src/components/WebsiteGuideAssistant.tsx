import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bot, CheckCircle2, MessageCircle, Send, ShieldAlert, X } from 'lucide-react'
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

type AssistantActionStatus = 'pending_confirmation' | 'confirming' | 'completed' | 'failed'

type AssistantActionRisk = 'low' | 'medium' | 'high'

const extractConfirmActionId = (content: string): string | null => {
  const match = content.match(/(?:確認|confirm)\s+([0-9a-fA-F-]{36})/i)
  return match?.[1] || null
}

const stripConfirmHint = (content: string): string =>
  content
    .replace(/\n?\s*若要套用，請回覆：?\s*(?:確認|confirm)\s+[0-9a-fA-F-]{36}\s*$/i, '')
    .trim()

const detectActionRisk = (content: string): AssistantActionRisk => {
  if (/(delete|remove|disable|password|secret|token|api[_\s-]?key|channel secret|撤銷|停用|刪除|密碼|金鑰)/i.test(content)) {
    return 'high'
  }

  if (/(update|toggle|config|bind|setting|修改|更新|綁定|設定|切換)/i.test(content)) {
    return 'medium'
  }

  return 'low'
}

const maskSecretsInText = (content: string): string =>
  content
    .replace(/(Bearer\s+)([A-Za-z0-9._~+\/-]{8,})/gi, '$1******')
    .replace(
      /(api[_\s-]?key|access[_\s-]?token|channel[_\s-]?secret|password|secret|token)\s*([:=：])\s*([^\s,;]+)/gi,
      '$1$2 ******',
    )

const actionStatusMeta: Record<
  AssistantActionStatus,
  { label: string; className: string }
> = {
  pending_confirmation: {
    label: '等待確認',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
  confirming: {
    label: '確認送出中',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
  },
  completed: {
    label: '已完成',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
  failed: {
    label: '確認失敗',
    className: 'bg-red-100 text-red-700 border border-red-200',
  },
}

const riskMeta: Record<AssistantActionRisk, { label: string; className: string }> = {
  low: {
    label: '低風險',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
  },
  medium: {
    label: '中風險',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
  },
  high: {
    label: '高風險',
    className: 'bg-red-100 text-red-700 border border-red-200',
  },
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
  const [actionStatusMap, setActionStatusMap] = useState<Record<string, AssistantActionStatus>>({})
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const confirmingActionIdRef = useRef<string | null>(null)

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

  const sendRawMessage = async (text: string) => {
    if (!text || loading) return

    const confirmingActionId = extractConfirmActionId(text)
    if (confirmingActionId) {
      setActionStatusMap((prev) => ({ ...prev, [confirmingActionId]: 'confirming' }))
      confirmingActionIdRef.current = confirmingActionId
    }

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

      if (confirmingActionIdRef.current) {
        const status: AssistantActionStatus = /(失敗|無法|錯誤|error|timeout|逾時)/i.test(content)
          ? 'failed'
          : 'completed'
        setActionStatusMap((prev) => ({ ...prev, [confirmingActionIdRef.current as string]: status }))
        confirmingActionIdRef.current = null
      }
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

      if (confirmingActionIdRef.current) {
        setActionStatusMap((prev) => ({ ...prev, [confirmingActionIdRef.current as string]: 'failed' }))
        confirmingActionIdRef.current = null
      }
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault()
    const text = input.trim()
    if (!text) return
    await sendRawMessage(text)
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
              <div key={`${message.role}-${index}`}>
                <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-6 whitespace-pre-wrap ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
                    }`}
                  >
                    {message.role === 'assistant'
                      ? maskSecretsInText(message.content)
                      : message.content}
                  </div>
                </div>

                {message.role === 'assistant' && extractConfirmActionId(message.content) && (() => {
                  const actionId = extractConfirmActionId(message.content) as string
                  const actionStatus = actionStatusMap[actionId] || 'pending_confirmation'
                  const risk = detectActionRisk(stripConfirmHint(message.content))
                  const statusInfo = actionStatusMeta[actionStatus]
                  const riskInfo = riskMeta[risk]

                  return (
                    <div className="mt-2 ml-2 rounded-xl border border-gray-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                          {risk === 'high' ? <ShieldAlert size={14} /> : <AlertTriangle size={14} />}
                          待確認操作卡（Phase 2）
                        </p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${riskInfo.className}`}>
                          {riskInfo.label}
                        </span>
                        <span className="text-[11px] text-gray-500">操作 ID：{actionId}</span>
                      </div>

                      <p className="mt-2 text-xs text-gray-600">此操作需要明確確認。建議先檢查設定變更內容，再送出確認。</p>

                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void sendRawMessage(`確認 ${actionId}`)}
                          disabled={loading || actionStatus === 'confirming' || actionStatus === 'completed'}
                          className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50"
                        >
                          {actionStatus === 'completed' ? (
                            <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} />已確認</span>
                          ) : (
                            '確認此操作'
                          )}
                        </button>
                        <span className="text-[11px] text-gray-500">或手動輸入：確認 {actionId}</span>
                      </div>
                    </div>
                  )
                })()}
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
                placeholder="可輸入：我的資料、把語言改成英文、把通知打開"
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
            <p className="mt-1 text-[11px] text-gray-400">安全提醒：請勿在對話中貼上完整密碼、Token 或 API Key。</p>
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
