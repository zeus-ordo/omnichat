import { Link, useLocation } from 'react-router-dom'
import { 
  MessageSquare, 
  BarChart3, 
  BookOpen, 
  Settings, 
  Plug,
  LogOut,
  Menu,
  Sparkles,
  ClipboardList,
  Bot,
  Users,
  Key,
  FileText
} from 'lucide-react'
import { 
  MessageSquare, 
  BarChart3, 
  BookOpen, 
  Settings, 
  Plug,
  LogOut,
  Menu,
  Sparkles,
  ClipboardList,
  Bot
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../store/auth'
import { useLanguageStore } from '../store/language'
import LanguageSwitcher from './LanguageSwitcher'

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { logout, user } = useAuthStore()
  const { t } = useLanguageStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  TX|  const navItems = [
NB|    { path: '/', icon: BarChart3, labelKey: 'dashboard', color: 'text-primary-500' },
BJ|    { path: '/bots', icon: Bot, labelKey: 'bots', color: 'text-accent-blue' },
SH|    { path: '/conversations', icon: MessageSquare, labelKey: 'conversations', color: 'text-accent-teal' },
ZJ|    { path: '/knowledge-base', icon: BookOpen, labelKey: 'knowledgeBase', color: 'text-accent-orange' },
TK|    { path: '/channels', icon: Plug, labelKey: 'channels', color: 'text-accent-pink' },
TX|    { path: '/surveys', icon: ClipboardList, labelKey: 'surveys', color: 'text-accent-purple' },
YH|    { path: '/users', icon: Users, labelKey: 'teamMembers', color: 'text-blue-500' },
ZH|    { path: '/api-keys', icon: Key, labelKey: 'apiKeys', color: 'text-green-500' },
BQ|    { path: '/message-templates', icon: FileText, labelKey: 'messageTemplates', color: 'text-purple-500' },
KQ|    { path: '/settings', icon: Settings, labelKey: 'settings', color: 'text-gray-500' },
KP|  ]
    { path: '/', icon: BarChart3, labelKey: 'dashboard', color: 'text-primary-500' },
    { path: '/bots', icon: Bot, labelKey: 'bots', color: 'text-accent-blue' },
    { path: '/conversations', icon: MessageSquare, labelKey: 'conversations', color: 'text-accent-teal' },
    { path: '/knowledge-base', icon: BookOpen, labelKey: 'knowledgeBase', color: 'text-accent-orange' },
    { path: '/channels', icon: Plug, labelKey: 'channels', color: 'text-accent-pink' },
    { path: '/surveys', icon: ClipboardList, labelKey: 'surveys', color: 'text-accent-purple' },
    { path: '/settings', icon: Settings, labelKey: 'settings', color: 'text-gray-500' },
  ]

  return (
    <div className="min-h-screen bg-surface-secondary flex">
      {/* Sidebar */}
      <aside 
        className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-surface-border flex flex-col fixed h-screen transition-all duration-300 z-10`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-surface-border">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                <Sparkles className="text-white" size={16} />
              </div>
              <span className="text-lg font-semibold text-gray-900">OmniBot</span>
            </div>
          )}
          {!sidebarOpen && (
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center mx-auto">
              <Sparkles className="text-white" size={16} />
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-surface-tertiary text-gray-500 transition-colors"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-apple transition-all duration-200 ${
                  isActive 
                    ? 'bg-primary-50 text-primary-600 shadow-sm' 
                    : 'text-gray-600 hover:bg-surface-tertiary hover:text-gray-900'
                }`}
              >
                <item.icon size={20} />
                {sidebarOpen && <span className="font-medium">{t(item.labelKey)}</span>}
              </Link>
            )
          })}
        </nav>

        {/* User & Language */}
        <div className="p-3 border-t border-surface-border space-y-2">
          {/* Language Switcher */}
          <LanguageSwitcher />
          
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-medium">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            )}
          </div>
          
          <button 
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors w-full flex items-center justify-center"
            title={t('logout')}
          >
            <LogOut size={18} />
            {sidebarOpen && <span className="ml-2 text-sm">{t('logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 ${sidebarOpen ? 'ml-64' : 'ml-20'} transition-all duration-300`}>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
