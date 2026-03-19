import { useState, useEffect, useRef } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  isSurvey?: boolean
  surveyId?: string
  surveyData?: SurveyData
}

interface ActionCard {
  actionId: string
  confirmationToken?: string
  preview: string
  riskLevel: 'low' | 'medium' | 'high'
}

interface ActionHistoryEntry {
  id: string
  action_type: string
  risk_level: 'low' | 'medium' | 'high'
  status: string
  created_at: string
  request_message?: string | null
  error_message?: string | null
}

interface SurveyData {
  surveyId?: string
  title: string
  description?: string
  questions: Question[]
}

interface Question {
  id: string
  type: 'text' | 'rating' | 'choice' | 'textarea'
  question: string
  options?: string[]
  required?: boolean
}

interface WidgetProps {
  apiKey: string
  position?: 'bottom-right' | 'bottom-left'
  authToken?: string
}

const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api'

const getStoredAuthToken = (): string | null => {
  try {
    const raw = window.localStorage.getItem('omnibot-auth')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.state?.token || null
  } catch {
    return null
  }
}

const extractActionCard = (content: string): ActionCard | null => {
  const match = content.match(/(?:確認|confirm)\s+([0-9a-fA-F-]{36})(?:\s+([A-Za-z0-9]{8}))?/i)
  if (!match) return null

  const preview = content.replace(/\n?\s*若要套用，請回覆：?.*$/i, '').trim() || '待確認操作'
  let riskLevel: 'low' | 'medium' | 'high' = 'low'

  if (/(delete|remove|disable|password|secret|token|api[_\s-]?key|channel secret|撤銷|停用|刪除|密碼|金鑰)/i.test(preview)) {
    riskLevel = 'high'
  } else if (/(update|toggle|config|bind|setting|修改|更新|綁定|設定|切換)/i.test(preview)) {
    riskLevel = 'medium'
  }

  return {
    actionId: match[1],
    confirmationToken: match[2],
    preview,
    riskLevel,
  }
}

export default function Widget({ apiKey, position = 'bottom-right', authToken }: WidgetProps) {
  const resolvedAuthToken = authToken || getStoredAuthToken()
  const isAuthenticatedMode = Boolean(resolvedAuthToken)
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeSurvey, setActiveSurvey] = useState<SurveyData | null>(null)
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({})
  const [showHistory, setShowHistory] = useState(false)
  const [actionHistory, setActionHistory] = useState<ActionHistoryEntry[]>([])
  const [actionStatusMap, setActionStatusMap] = useState<Record<string, 'pending' | 'confirming' | 'completed' | 'failed'>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, activeSurvey])

  useEffect(() => {
    if (!isOpen || !isAuthenticatedMode || !resolvedAuthToken) return

    const loadHistory = async () => {
      try {
        const response = await fetch(`${API_BASE}/ai/assistant/actions/history`, {
          headers: {
            Authorization: `Bearer ${resolvedAuthToken}`,
          },
        })

        if (!response.ok) {
          return
        }

        const data = await response.json()
        if (Array.isArray(data)) {
          setActionHistory(data)
        }
      } catch {
        // keep widget usable even if history load fails
      }
    }

    void loadHistory()
  }, [isOpen, isAuthenticatedMode, resolvedAuthToken])

  const parseSurveyFromContent = (content: string): { surveyData: SurveyData; surveyId: string } | null => {
    if (!content.includes('📋') && !content.includes('**')) return null
    
    const lines = content.split('\n')
    let title = ''
    let questions: Question[] = []
    let inQuestions = false

    for (const line of lines) {
      if (line.includes('**') && !title) {
        title = line.replace(/[*#]/g, '').trim()
      } else if (line.includes('請回答以下問題') || line.includes('Please answer')) {
        inQuestions = true
      } else if (inQuestions && /^\d+\.\s/.test(line)) {
        questions.push({
          id: String(questions.length + 1),
          type: 'text',
          question: line.replace(/^\d+\.\s*/, '').trim(),
          required: false
        })
      }
    }

    if (questions.length === 0) return null

    return {
      surveyData: { title, questions },
      surveyId: `survey_${Date.now()}`
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    
    if (activeSurvey) {
      const currentQuestion = activeSurvey.questions[Object.keys(surveyAnswers).length]
      if (currentQuestion) {
        setSurveyAnswers(prev => ({
          ...prev,
          [currentQuestion.id]: userMessage
        }))
        
        const nextQuestionIndex = Object.keys(surveyAnswers).length + 1
        if (nextQuestionIndex < activeSurvey.questions.length) {
          setInput('')
          return
        } else {
          try {
            await fetch(`${API_BASE}/surveys/responses`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey,
              },
              body: JSON.stringify({
                survey_id: activeSurvey.surveyId || 'temp',
                answers: { ...surveyAnswers, [currentQuestion.id]: userMessage }
              }),
            })
            setMessages((prev) => [...prev, { 
              role: 'assistant', 
              content: 'Thank you for your feedback! 🎉' 
            }])
          } catch (error) {
            console.error('Failed to submit survey', error)
          }
          setActiveSurvey(null)
          setSurveyAnswers({})
          return
        }
      }
    }

    setLoading(true)

    try {
      const requestBody = isAuthenticatedMode
        ? {
            message: userMessage,
            history: [...messages, { role: 'user', content: userMessage }].map((message) => ({
              role: message.role,
              content: message.content,
            })),
          }
        : { message: userMessage }

      const response = await fetch(isAuthenticatedMode ? `${API_BASE}/ai/assistant/chat` : `${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(isAuthenticatedMode
            ? { Authorization: `Bearer ${resolvedAuthToken}` }
            : { 'X-API-Key': apiKey }),
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()
      const responseContent = data.content || 'Sorry, I could not process your request.'
      
      const surveyParsed = parseSurveyFromContent(responseContent)
      
      if (surveyParsed) {
        setMessages((prev) => [...prev, { 
          role: 'assistant', 
          content: responseContent,
          isSurvey: true,
          surveyId: surveyParsed.surveyId,
          surveyData: surveyParsed.surveyData
        }])
        setActiveSurvey({ ...surveyParsed.surveyData, surveyId: surveyParsed.surveyId })
        setSurveyAnswers({})
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: responseContent }])

        const actionCard = isAuthenticatedMode ? extractActionCard(responseContent) : null
        if (actionCard) {
          setActionStatusMap((prev) => ({ ...prev, [actionCard.actionId]: 'pending' }))
        }
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const skipSurvey = () => {
    setMessages((prev) => [...prev, { role: 'assistant', content: 'Survey skipped. Feel free to ask more questions!' }])
    setActiveSurvey(null)
    setSurveyAnswers({})
  }

  const confirmAction = async (card: ActionCard) => {
    if (!resolvedAuthToken) return

    setActionStatusMap((prev) => ({ ...prev, [card.actionId]: 'confirming' }))
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/ai/assistant/actions/confirm/${card.actionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resolvedAuthToken}`,
        },
        body: JSON.stringify(card.confirmationToken ? { confirmationToken: card.confirmationToken } : {}),
      })

      const data = await response.json()
      const content = response.ok
        ? `已完成設定。動作：${data.actionType || card.actionId}`
        : data.message || '確認失敗，請再試一次。'

      setMessages((prev) => [...prev, { role: 'assistant', content }])
      setActionStatusMap((prev) => ({
        ...prev,
        [card.actionId]: response.ok ? 'completed' : 'failed',
      }))

      const historyResponse = await fetch(`${API_BASE}/ai/assistant/actions/history`, {
        headers: {
          Authorization: `Bearer ${resolvedAuthToken}`,
        },
      })
      if (historyResponse.ok) {
        const historyData = await historyResponse.json()
        if (Array.isArray(historyData)) {
          setActionHistory(historyData)
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: '確認失敗，請再試一次。' }])
      setActionStatusMap((prev) => ({ ...prev, [card.actionId]: 'failed' }))
    } finally {
      setLoading(false)
    }
  }

  const renderActionHistory = () => {
    if (!isAuthenticatedMode || !showHistory) return null

    return (
      <div style={styles.historyPanel}>
        <div style={styles.historyTitle}>Action History</div>
        {actionHistory.length === 0 ? (
          <div style={styles.historyEmpty}>No assistant actions yet.</div>
        ) : (
          actionHistory.slice(0, 8).map((item) => (
            <div key={item.id} style={styles.historyItem}>
              <div style={styles.historyRow}>
                <span style={styles.historyAction}>{item.action_type}</span>
                <span style={styles.historyStatus}>{item.status}</span>
              </div>
              <div style={styles.historyPreview}>{item.request_message || item.error_message || 'No preview available'}</div>
              <div style={styles.historyMeta}>{new Date(item.created_at).toLocaleString()}</div>
            </div>
          ))
        )}
      </div>
    )
  }

  const renderSurveyQuestion = () => {
    if (!activeSurvey) return null
    
    const questionIndex = Object.keys(surveyAnswers).length
    const currentQuestion = activeSurvey.questions[questionIndex]
    
    if (!currentQuestion) return null

    return (
      <div style={styles.surveyContainer}>
        <div style={styles.surveyProgress}>
          Question {questionIndex + 1} of {activeSurvey.questions.length}
        </div>
        <div style={styles.surveyQuestion}>{currentQuestion.question}</div>
        {currentQuestion.type === 'rating' && (
          <div style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() => {
                  setSurveyAnswers(prev => ({ ...prev, [currentQuestion.id]: String(rating) }))
                  if (questionIndex + 1 >= activeSurvey.questions.length) {
                    setInput(String(rating))
                    setTimeout(() => sendMessage(), 100)
                  } else {
                    setInput('')
                  }
                }}
                style={styles.ratingButton}
              >
                {rating}
              </button>
            ))}
          </div>
        )}
        {currentQuestion.type === 'choice' && currentQuestion.options && (
          <div style={styles.choiceContainer}>
            {currentQuestion.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSurveyAnswers(prev => ({ ...prev, [currentQuestion.id]: option }))
                  if (questionIndex + 1 >= activeSurvey.questions.length) {
                    setInput(option)
                    setTimeout(() => sendMessage(), 100)
                  } else {
                    setInput('')
                  }
                }}
                style={styles.choiceButton}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }


  const styles: Record<string, React.CSSProperties> = {
    container: {
      position: 'fixed',
      bottom: position === 'bottom-right' ? '20px' : '20px',
      right: position === 'bottom-right' ? '20px' : 'auto',
      left: position === 'bottom-left' ? '20px' : 'auto',
      zIndex: 9999,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    button: {
      width: '60px',
      height: '60px',
      borderRadius: '30px',
      backgroundColor: '#0ea5e9',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 12px rgba(14, 165, 233, 0.4)',
      transition: 'transform 0.2s',
    },
    chatWindow: {
      position: 'absolute',
      bottom: '80px',
      right: position === 'bottom-right' ? '0' : 'auto',
      left: position === 'bottom-left' ? '0' : 'auto',
      width: '380px',
      height: '500px',
      backgroundColor: '#fff',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },
    header: {
      padding: '16px',
      backgroundColor: '#0ea5e9',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      justifyContent: 'space-between',
    },
    headerInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    historyToggle: {
      border: '1px solid rgba(255,255,255,0.35)',
      backgroundColor: 'rgba(255,255,255,0.12)',
      color: '#fff',
      borderRadius: '999px',
      padding: '6px 10px',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: 600,
    },
    messages: {
      flex: 1,
      overflowY: 'auto',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    inputArea: {
      padding: '12px',
      borderTop: '1px solid #e5e7eb',
      display: 'flex',
      gap: '8px',
    },
    input: {
      flex: 1,
      padding: '10px 14px',
      borderRadius: '20px',
      border: '1px solid #e5e7eb',
      outline: 'none',
      fontSize: '14px',
    },
    sendButton: {
      padding: '10px 16px',
      borderRadius: '20px',
      border: 'none',
      backgroundColor: '#0ea5e9',
      color: '#fff',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 500,
    },
    message: {
      maxWidth: '80%',
      padding: '10px 14px',
      borderRadius: '16px',
      fontSize: '14px',
      lineHeight: 1.5,
    },
    surveyContainer: {
      backgroundColor: '#f0f9ff',
      borderRadius: '12px',
      padding: '16px',
      marginTop: '8px',
    },
    surveyProgress: {
      fontSize: '12px',
      color: '#0ea5e9',
      fontWeight: 500,
      marginBottom: '8px',
    },
    surveyQuestion: {
      fontSize: '14px',
      fontWeight: 500,
      color: '#1f2937',
      marginBottom: '12px',
    },
    ratingContainer: {
      display: 'flex',
      gap: '8px',
      justifyContent: 'center',
    },
    ratingButton: {
      width: '36px',
      height: '36px',
      borderRadius: '18px',
      border: '1px solid #e5e7eb',
      backgroundColor: '#fff',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 500,
      color: '#374151',
    },
    choiceContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    choiceButton: {
      padding: '10px 14px',
      borderRadius: '10px',
      border: '1px solid #e5e7eb',
      backgroundColor: '#fff',
      cursor: 'pointer',
      fontSize: '13px',
      color: '#374151',
      textAlign: 'left',
    },
    skipButton: {
      marginTop: '12px',
      padding: '8px 12px',
      borderRadius: '8px',
      border: 'none',
      backgroundColor: 'transparent',
      color: '#9ca3af',
      cursor: 'pointer',
      fontSize: '12px',
      width: '100%',
    },
    confirmationContainer: {
      marginTop: '8px',
      padding: '12px',
      borderRadius: '12px',
      backgroundColor: '#fef3c7',
      border: '1px solid #f59e0b',
    },
    confirmationPreview: {
      fontSize: '13px',
      color: '#92400e',
      marginBottom: '10px',
      fontWeight: 500,
    },
    confirmationButtons: {
      display: 'flex',
      gap: '8px',
    },
    confirmButton: {
      flex: 1,
      padding: '8px 12px',
      borderRadius: '8px',
      border: 'none',
      backgroundColor: '#10b981',
      color: '#fff',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 500,
    },
    cancelButton: {
      flex: 1,
      padding: '8px 12px',
      borderRadius: '8px',
      border: '1px solid #d1d5db',
      backgroundColor: '#fff',
      color: '#6b7280',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 500,
    },
    confirmationResultSuccess: {
      marginTop: '8px',
      padding: '8px 12px',
      borderRadius: '8px',
      backgroundColor: '#d1fae5',
      color: '#065f46',
      fontSize: '13px',
    },
    confirmationResultError: {
      marginTop: '8px',
      padding: '8px 12px',
      borderRadius: '8px',
      backgroundColor: '#fee2e2',
      color: '#991b1b',
      fontSize: '13px',
    },
    riskBadge: {
      display: 'inline-block',
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '10px',
      fontWeight: 600,
      marginLeft: '6px',
      textTransform: 'uppercase',
    },
    riskHigh: {
      backgroundColor: '#fee2e2',
      color: '#dc2626',
    },
    riskMedium: {
      backgroundColor: '#fef3c7',
      color: '#d97706',
    },
    riskLow: {
      backgroundColor: '#d1fae5',
      color: '#059669',
    },
    historyPanel: {
      backgroundColor: '#eff6ff',
      border: '1px solid #bfdbfe',
      borderRadius: '12px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    historyTitle: {
      fontSize: '12px',
      fontWeight: 700,
      color: '#1d4ed8',
    },
    historyEmpty: {
      fontSize: '12px',
      color: '#6b7280',
    },
    historyItem: {
      backgroundColor: '#fff',
      border: '1px solid #dbeafe',
      borderRadius: '10px',
      padding: '10px',
    },
    historyRow: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '8px',
      marginBottom: '6px',
    },
    historyAction: {
      fontSize: '12px',
      fontWeight: 600,
      color: '#1f2937',
    },
    historyStatus: {
      fontSize: '11px',
      color: '#2563eb',
      textTransform: 'uppercase',
    },
    historyPreview: {
      fontSize: '12px',
      color: '#4b5563',
      lineHeight: 1.4,
    },
    historyMeta: {
      marginTop: '6px',
      fontSize: '11px',
      color: '#9ca3af',
    },
  }

  return (
    <div style={styles.container}>
      {isOpen && (
        <div style={styles.chatWindow}>
          <div style={styles.header}>
            <div style={styles.headerInfo}>
              <div style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                🤖
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>AI Assistant</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {isAuthenticatedMode ? 'Authenticated assistant mode' : 'Always here to help'}
                </div>
              </div>
            </div>
            {isAuthenticatedMode && (
              <button style={styles.historyToggle} onClick={() => setShowHistory((prev) => !prev)}>
                {showHistory ? 'Hide history' : 'History'}
              </button>
            )}
          </div>

          <div style={styles.messages}>
            {renderActionHistory()}
            {messages.length === 0 && !activeSurvey && (
              <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
                <div>Hello! How can I help you today?</div>
              </div>
            )}
            {messages.map((msg, index) => (
              <div key={index}>
                <div
                  style={{
                    ...styles.message,
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    backgroundColor: msg.role === 'user' ? '#0ea5e9' : '#f3f4f6',
                    color: msg.role === 'user' ? '#fff' : '#1f2937',
                  }}
                >
                  {msg.content}
                </div>
                {isAuthenticatedMode && msg.role === 'assistant' && (() => {
                  const actionCard = extractActionCard(msg.content)
                  if (!actionCard) return null

                  const actionStatus = actionStatusMap[actionCard.actionId] || 'pending'

                  return (
                    <div style={styles.confirmationContainer}>
                      <div style={styles.confirmationPreview}>
                        {actionCard.preview}
                        <span
                          style={{
                            ...styles.riskBadge,
                            ...(actionCard.riskLevel === 'high'
                              ? styles.riskHigh
                              : actionCard.riskLevel === 'medium'
                              ? styles.riskMedium
                              : styles.riskLow),
                          }}
                        >
                          {actionCard.riskLevel}
                        </span>
                      </div>
                      <div style={styles.confirmationButtons}>
                        <button
                          onClick={() => void confirmAction(actionCard)}
                          style={styles.confirmButton}
                          disabled={loading || actionStatus === 'confirming' || actionStatus === 'completed'}
                        >
                          {actionStatus === 'completed'
                            ? '已確認'
                            : actionStatus === 'confirming'
                            ? '確認中...'
                            : '確認'}
                        </button>
                        <button
                          onClick={() => setMessages((prev) => [...prev, { role: 'assistant', content: `已取消操作 ${actionCard.actionId}` }])}
                          style={styles.cancelButton}
                          disabled={loading || actionStatus === 'confirming'}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            ))}
            {loading && (
              <div style={{ ...styles.message, alignSelf: 'flex-start', backgroundColor: '#f3f4f6' }}>
                <span>Typing...</span>
              </div>
            )}
            
            {activeSurvey && renderSurveyQuestion()}
            
            <div ref={messagesEndRef} />
          </div>

          <div style={styles.inputArea}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={activeSurvey ? "Type your answer..." : "Type a message..."}
              style={styles.input}
              disabled={loading}
              autoFocus
            />
            <button 
              onClick={sendMessage} 
              style={styles.sendButton} 
              disabled={loading || !input.trim()}
            >
              Send
            </button>
          </div>
          
          {activeSurvey && (
            <div style={{ padding: '0 12px 12px' }}>
              <button onClick={skipSurvey} style={styles.skipButton}>
                Skip survey →
              </button>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        style={styles.button}
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        )}
      </button>
    </div>
  )
}
