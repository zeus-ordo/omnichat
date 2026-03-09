import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useLanguageStore } from '../store/language'
import { MessageCircle, Code, ExternalLink } from 'lucide-react'

export default function Channels() {
  const [channels, setChannels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useLanguageStore()

  useEffect(() => {
    loadChannels()
  }, [])

  const loadChannels = async () => {
    try {
      const response = await api.get('/channels')
      setChannels(response.data || [])
    } catch (error) {
      console.error('Failed to load channels', error)
    } finally {
      setLoading(false)
    }
  }

  const channelCards = [
    {
      id: 'web',
      name: t('website') || 'Website',
      description: 'Embed a chat widget on your website',
      icon: Code,
      color: 'bg-blue-500',
    },
    {
      id: 'line',
      name: t('LINE') || 'LINE',
      description: 'Connect your LINE Official Account',
      icon: MessageCircle,
      color: 'bg-green-500',
    },
    {
      id: 'facebook',
      name: t('Facebook') || 'Facebook',
      description: 'Connect your Facebook Page',
      icon: MessageCircle,
      color: 'bg-blue-600',
    },
    {
      id: 'api',
      name: t('api') || 'REST API',
      description: 'Build custom integrations',
      icon: Code,
      color: 'bg-purple-500',
    },
    {
      id: 'whatsapp',
      name: t('WhatsApp') || 'WhatsApp',
      description: 'Connect your WhatsApp Business Account',
      icon: MessageCircle,
      color: 'bg-green-600',
    },
  ]

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('channels') || 'Channels'}</h1>

      {loading ? (
        <div className="text-center py-8">{t('loading') || 'Loading...'}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {channelCards.map((channel) => {
            const isEnabled = channels.find((c) => c.id === channel.id)?.enabled
            return (
              <div key={channel.id} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className={`${channel.color} p-3 rounded-lg`}>
                    <channel.icon className="text-white" size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{channel.name}</h3>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked={isEnabled} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{channel.description}</p>
                    {channel.id === 'web' && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-2">Embed Code:</p>
                        <code className="text-xs bg-gray-800 text-gray-100 p-2 rounded block overflow-x-auto">
                          {`<script src="https://your-domain.com/widget.js" data-key="YOUR_API_KEY"></script>`}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
