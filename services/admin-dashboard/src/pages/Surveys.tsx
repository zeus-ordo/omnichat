import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useLanguageStore } from '../store/language'
import { 
  ClipboardList, 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  X,
  Check,
  MessageSquare,
  Tag,
  ToggleLeft,
  ToggleRight,
  Send
} from 'lucide-react'

interface Question {
  id: string
  type: 'text' | 'rating' | 'choice' | 'textarea'
  question: string
  options?: string[]
  required?: boolean
}

interface Survey {
  id: string
  title: string
  description?: string
  questions: Question[]
  trigger_keywords: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function Surveys() {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showResponses, setShowResponses] = useState<string | null>(null)
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null)
  const { t } = useLanguageStore()

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    trigger_keywords: '',
    is_active: true,
    questions: [] as Question[]
  })

  const [responses, setResponses] = useState<any[]>([])
  const [loadingResponses, setLoadingResponses] = useState(false)

  useEffect(() => {
    loadSurveys()
  }, [])

  const loadSurveys = async () => {
    try {
      const response = await api.get('/surveys')
      setSurveys(response.data || [])
    } catch (error) {
      console.error('Failed to load surveys', error)
    } finally {
      setLoading(false)
    }
  }

  const loadResponses = async (surveyId: string) => {
    setLoadingResponses(true)
    try {
      const response = await api.get(`/surveys/${surveyId}/responses`)
      setResponses(response.data || [])
    } catch (error) {
      console.error('Failed to load responses', error)
    } finally {
      setLoadingResponses(false)
    }
  }

  const handleViewResponses = async (surveyId: string) => {
    setShowResponses(surveyId)
    await loadResponses(surveyId)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const surveyData = {
      title: formData.title,
      description: formData.description,
      trigger_keywords: formData.trigger_keywords.split(',').map(k => k.trim()).filter(k => k),
      is_active: formData.is_active,
      questions: formData.questions.length > 0 ? formData.questions : [
        { id: '1', type: 'rating' as const, question: 'How would you rate your experience?', required: true },
        { id: '2', type: 'textarea' as const, question: 'Any additional feedback?', required: false }
      ]
    }

    try {
      if (editingSurvey) {
        await api.put(`/surveys/${editingSurvey.id}`, surveyData)
      } else {
        await api.post('/surveys', surveyData)
      }
      setShowModal(false)
      resetForm()
      loadSurveys()
    } catch (error) {
      console.error('Failed to save survey', error)
    }
  }

  const handleEdit = (survey: Survey) => {
    setEditingSurvey(survey)
    setFormData({
      title: survey.title,
      description: survey.description || '',
      trigger_keywords: survey.trigger_keywords?.join(', ') || '',
      is_active: survey.is_active,
      questions: survey.questions || []
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('areYouSureDelete'))) return
    
    try {
      await api.delete(`/surveys/${id}`)
      loadSurveys()
    } catch (error) {
      console.error('Failed to delete survey', error)
    }
  }

  const handleToggleActive = async (survey: Survey) => {
    try {
      await api.put(`/surveys/${survey.id}`, { is_active: !survey.is_active })
      loadSurveys()
    } catch (error) {
      console.error('Failed to toggle survey', error)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      trigger_keywords: '',
      is_active: true,
      questions: []
    })
    setEditingSurvey(null)
  }

  const addQuestion = () => {
    const newQuestion: Question = {
      id: String(Date.now()),
      type: 'text',
      question: '',
      required: false
    }
    setFormData({
      ...formData,
      questions: [...formData.questions, newQuestion]
    })
  }

  const removeQuestion = (id: string) => {
    setFormData({
      ...formData,
      questions: formData.questions.filter(q => q.id !== id)
    })
  }

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setFormData({
      ...formData,
      questions: formData.questions.map(q => q.id === id ? { ...q, ...updates } : q)
    })
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('surveys')}</h1>
          <p className="text-gray-500 mt-1">{t('createAndManageFeedbackSurveys')}</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          {t('createSurvey')}
        </button>
      </div>

      {surveys.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="text-primary-500" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('noSurveysYet')}</h3>
          <p className="text-gray-500 mb-4">{t('createFirstSurvey')}</p>
          <button 
            onClick={() => { resetForm(); setShowModal(true) }}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus size={18} />
            {t('createSurvey')}
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {surveys.map((survey) => (
            <div key={survey.id} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{survey.title}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      survey.is_active 
                        ? 'bg-green-50 text-green-600' 
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {survey.is_active ? t('active') : t('inactive')}
                    </span>
                  </div>
                  {survey.description && (
                    <p className="text-gray-500 text-sm mb-3">{survey.description}</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <MessageSquare size={14} />
                      <span>{survey.questions?.length || 0} {t('questions')}</span>
                    </div>
                    
                    {survey.trigger_keywords && survey.trigger_keywords.length > 0 && (
                      <div className="flex items-center gap-1.5 text-accent-pink">
                        <Tag size={14} />
                        <span className="text-xs">
                          {survey.trigger_keywords.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(survey)}
                    className={`p-2 rounded-lg transition-colors ${
                      survey.is_active 
                        ? 'text-green-600 hover:bg-green-50' 
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                    title={survey.is_active ? t('disable') : t('enable')}
                  >
                    {survey.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  </button>
                  
                  <button
                    onClick={() => handleViewResponses(survey.id)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                    title={t('viewResponses')}
                  >
                    <Eye size={18} />
                  </button>
                  
                  <button
                    onClick={() => handleEdit(survey)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                    title={t('edit')}
                  >
                    <Edit2 size={18} />
                  </button>
                  
                  <button
                    onClick={() => handleDelete(survey.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title={t('delete')}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold">
                {editingSurvey ? t('editSurvey') : t('createSurvey')}
              </h2>
              <button 
                onClick={() => { setShowModal(false); resetForm() }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('surveyTitle')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="input-field"
                    placeholder={t('surveyTitlePlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('description')}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field"
                    rows={2}
                    placeholder={t('surveyDescriptionPlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Tag size={14} className="inline mr-1" />
                    {t('triggerKeywords')}
                  </label>
                  <input
                    type="text"
                    value={formData.trigger_keywords}
                    onChange={(e) => setFormData({ ...formData, trigger_keywords: e.target.value })}
                    className="input-field"
                    placeholder={t('triggerKeywordsPlaceholder')}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('surveyWillBeSentWhen')}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className={`p-1 rounded transition-colors ${
                      formData.is_active ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    {formData.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>
                  <span className="text-sm text-gray-600">
                    {formData.is_active ? t('active') : t('inactive')}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    {t('questions')}
                  </label>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <Plus size={16} />
                    {t('addQuestion')}
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.questions.map((question, index) => (
                    <div key={question.id} className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-start gap-3">
                        <span className="text-sm font-medium text-gray-500 mt-2">
                          {index + 1}.
                        </span>
                        <div className="flex-1 space-y-3">
                          <input
                            type="text"
                            value={question.question}
                            onChange={(e) => updateQuestion(question.id, { question: e.target.value })}
                            className="input-field"
                            placeholder={t('questionPlaceholder')}
                          />
                          
                          <div className="flex items-center gap-3">
                            <select
                              value={question.type}
                              onChange={(e) => updateQuestion(question.id, { 
                                type: e.target.value as Question['type'],
                                options: e.target.value === 'choice' ? ['Option 1', 'Option 2'] : undefined
                              })}
                              className="input-field text-sm w-auto"
                            >
                              <option value="text">{t('shortText')}</option>
                              <option value="textarea">{t('longText')}</option>
                              <option value="rating">{t('rating')}</option>
                              <option value="choice">{t('multipleChoice')}</option>
                            </select>
                            
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                              <input
                                type="checkbox"
                                checked={question.required || false}
                                onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                                className="rounded border-gray-300"
                              />
                              {t('required')}
                            </label>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeQuestion(question.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {formData.questions.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No custom questions added. Default questions will be used.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm() }}
                  className="btn-secondary"
                >
                  {t('cancel')}
                </button>
                <button type="submit" className="btn-primary flex items-center gap-2">
                  <Check size={18} />
                  {editingSurvey ? t('updateSurvey') : t('createSurvey')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResponses && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-semibold">{t('surveyResponses')}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {responses.length} response{responses.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button 
                onClick={() => setShowResponses(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {loadingResponses ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : responses.length === 0 ? (
                <div className="text-center py-8">
                  <Send className="mx-auto text-gray-300 mb-3" size={32} />
                  <p className="text-gray-500">{t('noResponsesYet')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {responses.map((response) => (
                    <div key={response.id} className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">
                          Conversation #{response.conversation_id?.slice(0, 8)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(response.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(response.answers || {}).map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="text-gray-500">{key}:</span>{' '}
                            <span className="text-gray-900">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
