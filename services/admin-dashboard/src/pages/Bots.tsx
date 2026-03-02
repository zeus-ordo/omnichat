import { useState } from 'react'
import { useLanguageStore } from '../store/language'
import { 
  Plus, 
  Bot, 
  MessageSquare, 
  FileText, 
  ClipboardList,
  Globe,
  MessageCircle,
  Code,
  Settings,
  Trash2,
  Edit2,
  X,
  Check,
  Upload,
  Brain,
  Database,
  Wifi,
  WifiOff
} from 'lucide-react'

interface BotChannel {
  id: string
  type: 'web' | 'line' | 'facebook' | 'api'
  enabled: boolean
  name: string
}

interface Bot {
  id: string
  name: string
  avatar?: string
  model: string
  database: string
  channels: BotChannel[]
  surveys: string[]
  surveysCount: number
  documentsCount: number
  conversationsCount: number
  messagesCount: number
  lastActive: string
  isActive: boolean
}

const defaultBots: Bot[] = [
  {
    id: '1',
    name: 'Customer Support Bot',
    avatar: undefined,
    model: 'GPT-4o',
    database: 'omnibot_db',
    channels: [
      { id: '1', type: 'web', enabled: true, name: 'Website' },
      { id: '2', type: 'line', enabled: true, name: 'LINE' },
      { id: '3', type: 'facebook', enabled: false, name: 'Facebook' },
      { id: '4', type: 'api', enabled: true, name: 'REST API' },
    ],
    surveys: ['survey-1'],
    surveysCount: 1,
    documentsCount: 15,
    conversationsCount: 156,
    messagesCount: 1247,
    lastActive: '2 hours ago',
    isActive: true,
  },
  {
    id: '2',
    name: 'Sales Assistant',
    avatar: undefined,
    model: 'Claude 3.5 Sonnet',
    database: 'omnibot_sales',
    channels: [
      { id: '1', type: 'web', enabled: true, name: 'Website' },
      { id: '2', type: 'line', enabled: false, name: 'LINE' },
      { id: '3', type: 'facebook', enabled: true, name: 'Facebook' },
      { id: '4', type: 'api', enabled: false, name: 'REST API' },
    ],
    surveys: [],
    surveysCount: 0,
    documentsCount: 28,
    conversationsCount: 89,
    messagesCount: 456,
    lastActive: '1 day ago',
    isActive: true,
  },
  {
    id: '3',
    name: 'HR Assistant',
    avatar: undefined,
    model: 'GPT-4 Turbo',
    database: 'omnibot_hr',
    channels: [
      { id: '1', type: 'web', enabled: true, name: 'Website' },
      { id: '2', type: 'line', enabled: false, name: 'LINE' },
      { id: '3', type: 'facebook', enabled: false, name: 'Facebook' },
      { id: '4', type: 'api', enabled: true, name: 'REST API' },
    ],
    surveys: [],
    surveysCount: 0,
    documentsCount: 42,
    conversationsCount: 34,
    messagesCount: 189,
    lastActive: '3 days ago',
    isActive: false,
  },
]

const modelOptions = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
]

const channelIcons: Record<string, typeof Globe> = {
  web: Globe,
  line: MessageCircle,
  facebook: MessageCircle,
  api: Code,
}

// Available databases for selection
const databaseOptions = [
  { value: 'omnibot_db', label: 'omnibot_db' },
  { value: 'omnibot_sales', label: 'omnibot_sales' },
  { value: 'omnibot_hr', label: 'omnibot_hr' },
  { value: 'omnibot_support', label: 'omnibot_support' },
  { value: 'omnibot_marketing', label: 'omnibot_marketing' },
]

// Available surveys for selection (mock data)
const availableSurveys = [
  { id: 'survey-1', title: 'Customer Feedback' },
  { id: 'survey-2', title: 'Product Satisfaction' },
  { id: 'survey-3', title: 'Support Experience' },
]

// Channel types for selection
const channelTypes = [
  { type: 'web', name: 'Website', icon: Globe },
  { type: 'line', name: 'LINE', icon: MessageCircle },
  { type: 'facebook', name: 'Facebook', icon: MessageCircle },
  { type: 'api', name: 'REST API', icon: Code },
]

export default function Bots() {
  const [bots, setBots] = useState<Bot[]>(defaultBots)
  const [showModal, setShowModal] = useState(false)
  const [editingBot, setEditingBot] = useState<Bot | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    model: 'gpt-4o',
    database: '',
  })
  const { t } = useLanguageStore()

  // Handler to toggle channel enabled status
  const handleChannelToggle = (botId: string, channelType: string) => {
    setBots(bots.map(bot => {
      if (bot.id === botId) {
        return {
          ...bot,
          channels: bot.channels.map(ch => 
            ch.type === channelType ? { ...ch, enabled: !ch.enabled } : ch
          )
        }
      }
      return bot
    }))
  }

  // Handler to update bot's database
  const handleDatabaseChange = (botId: string, database: string) => {
    setBots(bots.map(bot => 
      bot.id === botId ? { ...bot, database } : bot
    ))
  }

  // Handler to toggle survey
  const handleSurveyToggle = (botId: string, surveyId: string) => {
    setBots(bots.map(bot => {
      if (bot.id === botId) {
        const hasSurvey = bot.surveys.includes(surveyId)
        const newSurveys = hasSurvey 
          ? bot.surveys.filter(s => s !== surveyId)
          : [...bot.surveys, surveyId]
        return {
          ...bot,
          surveys: newSurveys,
          surveysCount: newSurveys.length
        }
      }
      return bot
    }))
  }

  const handleCreateBot = () => {
    setEditingBot(null)
    setFormData({ name: '', model: 'gpt-4o', database: '' })
    setShowModal(true)
  }

  const handleEditBot = (bot: Bot) => {
    setEditingBot(bot)
    setFormData({
      name: bot.name,
      model: bot.model.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      database: bot.database,
    })
    setShowModal(true)
  }

  const handleDeleteBot = (id: string) => {
    if (confirm(t('areYouSure'))) {
      setBots(bots.filter(b => b.id !== id))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const modelLabel = modelOptions.find(m => m.value === formData.model)?.label || formData.model

    if (editingBot) {
      setBots(bots.map(bot => 
        bot.id === editingBot.id 
          ? { 
              ...bot, 
              name: formData.name, 
              model: modelLabel,
              database: formData.database || bot.database
            } 
          : bot
      ))
    } else {
      const newBot: Bot = {
        id: String(bots.length + 1),
        name: formData.name,
        model: modelLabel,
        database: formData.database || 'omnibot_new',
        channels: [
          { id: '1', type: 'web', enabled: true, name: 'Website' },
          { id: '2', type: 'line', enabled: false, name: 'LINE' },
          { id: '3', type: 'facebook', enabled: false, name: 'Facebook' },
          { id: '4', type: 'api', enabled: false, name: 'REST API' },
        ],
        surveys: [],
        surveysCount: 0,
        documentsCount: 0,
        conversationsCount: 0,
        messagesCount: 0,
        lastActive: 'Just now',
        isActive: true,
      }
      setBots([...bots, newBot])
    }
    
    setShowModal(false)
  }

  const getChannelIcon = (type: string) => {
    return channelIcons[type] || Globe
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('bots')}</h1>
          <p className="text-gray-500 mt-1">{t('botSettings')}</p>
        </div>
        <button 
          onClick={handleCreateBot}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          {t('createBot')}
        </button>
      </div>

      {/* Bot Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bots.map((bot) => (
          <div key={bot.id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            {/* Card Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                    {bot.avatar ? (
                      <img src={bot.avatar} alt={bot.name} className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      bot.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-white shadow-md rounded-full flex items-center justify-center text-gray-500 hover:text-primary-600">
                    <Upload size={12} />
                  </button>
                </div>
                
                {/* Bot Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{bot.name}</h3>
                    <span className={`w-2 h-2 rounded-full ${bot.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{bot.lastActive}</p>
                </div>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-6 space-y-4">
              {/* AI Model */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Brain className="text-blue-500" size={16} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('aiModel')}</p>
                  <p className="text-sm font-medium text-gray-900">{bot.model}</p>
                </div>
              </div>

              {/* Database - Interactive Dropdown */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                  <Database className="text-purple-500" size={16} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">{t('database')}</p>
                  <select
                    value={bot.database}
                    onChange={(e) => handleDatabaseChange(bot.id, e.target.value)}
                    className="text-sm font-medium text-gray-900 bg-transparent border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 rounded px-1 -ml-1 w-full"
                  >
                    {databaseOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Channels - Interactive Toggle */}
              <div>
                <p className="text-xs text-gray-500 mb-2">{t('botChannels')}</p>
                <div className="flex flex-wrap gap-2">
                  {channelTypes.map(({ type, name, icon: Icon }) => {
                    const channel = bot.channels.find(c => c.type === type)
                    const enabled = channel?.enabled ?? false
                    return (
                      <button
                        key={type}
                        onClick={() => handleChannelToggle(bot.id, type)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          enabled
                            ? 'bg-green-100 text-green-700 ring-2 ring-green-500 ring-opacity-50'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                        title={name}
                      >
                        {enabled ? <Wifi size={12} /> : <WifiOff size={12} />}
                        <Icon size={12} />
                        <span>{name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Surveys - Interactive Selection */}
              <div>
                <p className="text-xs text-gray-500 mb-2">{t('botSurveys')}</p>
                <div className="flex flex-wrap gap-2">
                  {availableSurveys.map(survey => {
                    const isSelected = bot.surveys.includes(survey.id)
                    return (
                      <button
                        key={survey.id}
                        onClick={() => handleSurveyToggle(bot.id, survey.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500 ring-opacity-50'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                        title={survey.title}
                      >
                        {isSelected ? <Check size={12} /> : <ClipboardList size={12} />}
                        <span className="truncate max-w-[100px]">{survey.title}</span>
                      </button>
                    )
                  })}
                  {availableSurveys.length === 0 && (
                    <p className="text-xs text-gray-400 italic">{t('noSurveysYet')}</p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900">{bot.conversationsCount}</p>
                  <p className="text-xs text-gray-500">{t('botConversations')}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900">{bot.messagesCount}</p>
                  <p className="text-xs text-gray-500">{t('botMessages')}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900">{bot.surveysCount}</p>
                  <p className="text-xs text-gray-500">{t('botSurveys')}</p>
                </div>
              </div>
            </div>

            {/* Card Footer */}
            <div className="px-6 py-3 bg-gray-50 flex items-center justify-end gap-2">
              <button
                onClick={() => handleEditBot(bot)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title={t('edit')}
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => handleDeleteBot(bot.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title={t('delete')}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingBot ? t('editBot') : t('createBot')}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('botName')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('aiModel')}
                </label>
                <select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {modelOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('database')}
                </label>
                <select
                  value={formData.database}
                  onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select database</option>
                  {databaseOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  {editingBot ? t('save') : t('createBot')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
