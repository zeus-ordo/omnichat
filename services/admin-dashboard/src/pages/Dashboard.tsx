import { useEffect, useState } from 'react'
import { MessageSquare, Users, Zap, Activity, ArrowRight, BookOpen, Plug, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { Link } from 'react-router-dom'
import { useLanguageStore } from '../store/language'

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { t } = useLanguageStore()

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const response = await api.get('/analytics/overview')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to load stats', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { 
      labelKey: 'totalConversations', 
      value: stats?.total_conversations || 0, 
      icon: MessageSquare,
      bgColor: 'bg-primary-50',
    },
    { 
      labelKey: 'activeConversations', 
      value: stats?.active_conversations || 0, 
      icon: Activity,
      bgColor: 'bg-teal-50',
    },
    { 
      labelKey: 'totalMessages', 
      value: stats?.total_messages || 0, 
      icon: Users,
      bgColor: 'bg-pink-50',
    },
    { 
      labelKey: 'aiTokensUsed', 
      value: stats?.total_tokens?.toLocaleString() || 0, 
      icon: Zap,
      bgColor: 'bg-orange-50',
    },
  ]

  const quickActions = [
    {
      titleKey: 'viewConversations',
      descriptionKey: 'manageActiveChats',
      icon: MessageSquare,
      href: '/conversations',
      color: 'text-primary-500',
      bgColor: 'bg-primary-50',
    },
    {
      titleKey: 'addKnowledge',
      descriptionKey: 'uploadDocumentsForAi',
      icon: BookOpen,
      href: '/knowledge-base',
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
    },
    {
      titleKey: 'configureChannels',
      descriptionKey: 'lineFacebookApi',
      icon: Plug,
      href: '/channels',
      color: 'text-pink-500',
      bgColor: 'bg-pink-50',
    },
  ]

  const gettingStartedItems = [
    { num: '01', titleKey: 'addKnowledgeBase', descKey: 'uploadDocumentsForAiToLearn' },
    { num: '02', titleKey: 'configureChannelsConnect', descKey: 'connectLineFacebookOrApi' },
    { num: '03', titleKey: 'embedOnWebsite', descKey: 'copyTheWidgetCodeToYourSite' },
    { num: '04', titleKey: 'startChatting', descKey: 'yourAiIsReadyToHelpCustomers' },
  ]

  return (
    <div className="animate-fade-in p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{t('dashboard')}</h1>
        <p className="text-gray-500 mt-1">{t('welcomeBack')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {statCards.map((stat, index) => (
          <div 
            key={index} 
            className="stat-card group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{t(stat.labelKey)}</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">
                  {loading ? '...' : stat.value}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${stat.bgColor} group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className="text-gray-700" size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions & Getting Started */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="text-primary-500" size={20} />
            <h2 className="text-lg font-semibold text-gray-900">{t('quickActions')}</h2>
          </div>
          <div className="space-y-3">
            {quickActions.map((action, index) => (
              <Link
                key={index}
                to={action.href}
                className="flex items-center gap-4 p-4 rounded-apple-lg bg-surface-secondary hover:bg-surface-tertiary transition-all duration-200 group"
              >
                <div className={`p-2.5 rounded-lg ${action.bgColor}`}>
                  <action.icon className={action.color} size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{t(action.titleKey)}</p>
                  <p className="text-sm text-gray-500">{t(action.descriptionKey)}</p>
                </div>
                <ArrowRight className="text-gray-400 group-hover:translate-x-1 transition-transform" size={18} />
              </Link>
            ))}
          </div>
        </div>

        {/* Getting Started */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">{t('gettingStarted')}</h2>
          <div className="space-y-4">
            {gettingStartedItems.map((item, index) => (
              <div key={index} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-sm font-semibold shrink-0">
                  {item.num}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{t(item.titleKey as any)}</p>
                  <p className="text-sm text-gray-500">{t(item.descKey as any)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
