import { useState, useEffect, useRef } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  isSurvey?: boolean
  surveyId?: string
  surveyData?: SurveyData
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
}

export default function Widget({ apiKey, position = 'bottom-right' }: WidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeSurvey, setActiveSurvey] = useState<SurveyData | null>(null)
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, activeSurvey])

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
            await fetch(`http://localhost:8080/api/surveys/responses`, {
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
      const response = await fetch(`http://localhost:8080/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({ message: userMessage }),
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
    }
  }

  return (
    <div style={styles.container}>
      {isOpen && (
        <div style={styles.chatWindow}>
          <div style={styles.header}>
            <div style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              🤖
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>AI Assistant</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Always here to help</div>
            </div>
          </div>

          <div style={styles.messages}>
            {messages.length === 0 && !activeSurvey && (
              <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
                <div>Hello! How can I help you today?</div>
              </div>
            )}
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  ...styles.message,
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: msg.role === 'user' ? '#0ea5e9' : '#f3f4f6',
                  color: msg.role === 'user' ? '#fff' : '#1f2937',
                }}
              >
                {msg.content}
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
            <button onClick={sendMessage} style={styles.sendButton} disabled={loading || !input.trim()}>
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
