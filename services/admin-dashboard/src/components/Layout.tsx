import { Link, useLocation } from 'react-router-dom'
import { 
  MessageSquare, 
  BarChart3, 
  BookOpen, 
  Settings,
  Plug,
  LogOut,
  Menu,
  X,
  Sparkles,
  ClipboardList,
  Bot,
  Users,
  Key,
  FileText,
  Ticket,
  Activity,
  Radio
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../store/auth'
import { useLanguageStore } from '../store/language'
import LanguageSwitcher from './LanguageSwitcher'
import WebsiteGuideAssistant from './WebsiteGuideAssistant'

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { logout, user } = useAuthStore()
  const { t } = useLanguageStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { path: '/', icon: BarChart3, labelKey: 'dashboard', color: 'text-primary-500' },
    { path: '/analytics', icon: Activity, labelKey: 'analytics', color: 'text-blue-500' },
    { path: '/bots', icon: Bot, labelKey: 'bots', color: 'text-blue-500' },
    { path: '/conversations', icon: MessageSquare, labelKey: 'conversations', color: 'text-blue-500' },
    { path: '/knowledge-base', icon: BookOpen, labelKey: 'knowledgeBase', color: 'text-blue-500' },
    { path: '/channels', icon: Plug, labelKey: 'channels', color: 'text-blue-500' },
    { path: '/surveys', icon: ClipboardList, labelKey: 'surveys', color: 'text-blue-500' },
    { path: '/users', icon: Users, labelKey: 'teamMembers', color: 'text-blue-500' },
    { path: '/api-keys', icon: Key, labelKey: 'apiKeys', color: 'text-green-500' },
    { path: '/message-templates', icon: FileText, labelKey: 'messageTemplates', color: 'text-purple-500' },
    { path: '/tickets', icon: Ticket, labelKey: 'tickets', color: 'text-red-500' },
    { path: '/broadcasts', icon: Radio, labelKey: 'broadcasts', color: 'text-blue-500' },
    { path: '/settings', icon: Settings, labelKey: 'settings', color: 'text-gray-500' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <button
        onClick={() => setMobileMenuOpen(true)}
        className="fixed top-3 left-3 z-30 md:hidden p-2.5 rounded-lg bg-white shadow border border-gray-200"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'md:w-64' : 'md:w-20'} w-72 bg-white border-r border-gray-200 flex flex-col fixed h-screen transition-all duration-300 z-30 md:z-10 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Sparkles className="text-white" size={16} />
              </div>
              <span className="font-bold text-lg">OmniChat</span>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-gray-100 hidden md:block">
            <Menu size={20} />
          </button>
          <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 md:hidden">
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={20} className={isActive ? 'text-blue-600' : ''} />
                    {sidebarOpen && <span>{t(item.labelKey) || item.labelKey}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User */}
        <div className="border-t border-gray-200 p-4">
          {sidebarOpen && user && (
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-medium text-sm">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg w-full"
            >
              <LogOut size={18} />
              {sidebarOpen && <span>{t('logout')}</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 w-full ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'} ml-0 transition-all duration-300 pt-14 md:pt-0`}>
        {children}
      </main>

      <WebsiteGuideAssistant />
    </div>
  )
}
