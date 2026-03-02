import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { BarChart3, TrendingUp, Users, MessageSquare, Clock, Zap, Star, Hash, PieChart, Activity } from 'lucide-react'
import { useLanguageStore } from '../store/language'

interface AnalyticsData {
  overview: {
    total_conversations: number
    active_conversations: number
    total_messages: number
    total_tokens: number
  }
  daily: any[]
  hourly: any[]
  aiPerformance: any[]
  conversationMetrics: any
  responseTime: any
  channelComparison: any[]
  agentPerformance: any[]
  messageTrends: any[]
  popularTopics: any[]
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const { t } = useLanguageStore()

  useEffect(() => {
    loadAnalytics()
  }, [days])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const [
        overviewRes,
        dailyRes,
        hourlyRes,
        aiPerfRes,
        convMetricsRes,
        responseTimeRes,
        channelCompRes,
        agentPerfRes,
        msgTrendsRes,
        topicsRes
      ] = await Promise.all([
        api.get('/analytics/overview'),
        api.get(`/analytics/daily?days=${days}`),
        api.get(`/analytics/hourly?days=7`),
        api.get(`/analytics/ai-performance?days=${days}`),
        api.get(`/analytics/conversation-metrics?days=${days}`),
        api.get(`/analytics/response-time?days=${days}`),
        api.get(`/analytics/channel-comparison?days=${days}`),
        api.get(`/analytics/agent-performance?days=${days}`),
        api.get(`/analytics/message-trends?days=${days}`),
        api.get('/analytics/popular-topics?limit=10')
      ])

      setData({
        overview: overviewRes.data,
        daily: dailyRes.data,
        hourly: hourlyRes.data,
        aiPerformance: aiPerfRes.data,
        conversationMetrics: convMetricsRes.data,
        responseTime: responseTimeRes.data,
        channelComparison: channelCompRes.data,
        agentPerformance: agentPerfRes.data,
        messageTrends: msgTrendsRes.data,
        popularTopics: topicsRes.data
      })
    } catch (error) {
      console.error('Failed to load analytics', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    )
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num?.toString() || '0'
  }

  const formatResponseTime = (seconds: number) => {
    if (!seconds) return 'N/A'
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    return `${(seconds / 60).toFixed(1)}m`
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('analytics') || 'Analytics'}</h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="input-field"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Conversations</p>
              <p className="text-2xl font-bold">{formatNumber(data?.overview.total_conversations || 0)}</p>
            </div>
            <MessageSquare className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Conversations</p>
              <p className="text-2xl font-bold">{formatNumber(data?.overview.active_conversations || 0)}</p>
            </div>
            <Activity className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Messages</p>
              <p className="text-2xl font-bold">{formatNumber(data?.overview.total_messages || 0)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">AI Tokens Used</p>
              <p className="text-2xl font-bold">{formatNumber(data?.overview.total_tokens || 0)}</p>
            </div>
            <Zap className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Conversation Metrics */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">Conversation Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{data?.conversationMetrics?.total || 0}</p>
            <p className="text-sm text-gray-500">Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{data?.conversationMetrics?.active || 0}</p>
            <p className="text-sm text-gray-500">Active</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-600">{data?.conversationMetrics?.closed || 0}</p>
            <p className="text-sm text-gray-500">Closed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{data?.conversationMetrics?.assigned || 0}</p>
            <p className="text-sm text-gray-500">Assigned</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">{data?.conversationMetrics?.unassigned || 0}</p>
            <p className="text-sm text-gray-500">Unassigned</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-cyan-600">
              {data?.conversationMetrics?.total > 0 
                ? ((data?.conversationMetrics?.closed / data?.conversationMetrics?.total) * 100).toFixed(0)
                : 0}%
            </p>
            <p className="text-sm text-gray-500">Resolution Rate</p>
          </div>
        </div>
      </div>

      {/* Response Time & AI Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Response Time */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Response Time
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Average</span>
              <span className="font-semibold">{formatResponseTime(data?.responseTime?.avg_response_time)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Median</span>
              <span className="font-semibold">{formatResponseTime(data?.responseTime?.median_response_time)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Min</span>
              <span className="font-semibold">{formatResponseTime(data?.responseTime?.min_response_time)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Max</span>
              <span className="font-semibold">{formatResponseTime(data?.responseTime?.max_response_time)}</span>
            </div>
          </div>
        </div>

        {/* AI Performance */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            AI Model Performance
          </h2>
          <div className="space-y-3">
            {data?.aiPerformance?.map((model: any, idx: number) => (
              <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{model.model_used}</span>
                  <span className="text-sm text-gray-500">{model.total_responses} responses</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Total Tokens</p>
                    <p className="font-semibold">{formatNumber(model.total_tokens)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Avg/Response</p>
                    <p className="font-semibold">{model.avg_tokens}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Conversations</p>
                    <p className="font-semibold">{model.unique_conversations}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Channel Comparison */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <PieChart className="w-5 h-5" />
          Channel Comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Channel</th>
                <th className="text-right py-2">Conversations</th>
                <th className="text-right py-2">Messages</th>
                <th className="text-right py-2">Avg Tokens</th>
                <th className="text-right py-2">Agents</th>
              </tr>
            </thead>
            <tbody>
              {data?.channelComparison?.map((ch: any, idx: number) => (
                <tr key={idx} className="border-b">
                  <td className="py-2 capitalize">{ch.channel}</td>
                  <td className="text-right">{ch.total_conversations}</td>
                  <td className="text-right">{ch.total_messages}</td>
                  <td className="text-right">{ch.avg_tokens_per_conversation || 0}</td>
                  <td className="text-right">{ch.agents_assigned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent Performance */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Agent Performance
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Agent</th>
                <th className="text-right py-2">Assigned</th>
                <th className="text-right py-2">Resolved</th>
                <th className="text-right py-2">Rate</th>
                <th className="text-right py-2">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {data?.agentPerformance?.map((agent: any, idx: number) => (
                <tr key={idx} className="border-b">
                  <td className="py-2">
                    <div>
                      <p className="font-medium">{agent.name || 'Unknown'}</p>
                      <p className="text-sm text-gray-500">{agent.email}</p>
                    </div>
                  </td>
                  <td className="text-right">{agent.assigned_conversations}</td>
                  <td className="text-right">{agent.resolved_conversations}</td>
                  <td className="text-right">{agent.resolution_rate || 0}%</td>
                  <td className="text-right text-sm text-gray-500">
                    {agent.last_activity ? new Date(agent.last_activity).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Popular Topics */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Hash className="w-5 h-5" />
          Popular Topics
        </h2>
        <div className="flex flex-wrap gap-2">
          {data?.popularTopics?.map((topic: any, idx: number) => (
            <div key={idx} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
              <span className="font-medium">{topic.keyword}</span>
              <span className="text-gray-500 ml-1">({topic.frequency})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
