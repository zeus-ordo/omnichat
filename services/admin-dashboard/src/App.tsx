import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Conversations from './pages/Conversations'
import KnowledgeBase from './pages/KnowledgeBase'
import Settings from './pages/Settings'
import Channels from './pages/Channels'
import Surveys from './pages/Surveys'
import Bots from './pages/Bots'
import Users from './pages/Users'
import ApiKeys from './pages/ApiKeys'
import MessageTemplates from './pages/MessageTemplates'
import Tickets from './pages/Tickets'
import Broadcasts from './pages/Broadcasts'
import MessageTemplates from '../src/pages/MessageTemplates'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  return token ? <>{children}</> : <Navigate to="/login" />
}

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/conversations" element={<Conversations />} />
                  <Route path="/conversations/:id" element={<Conversations />} />
                  <Route path="/knowledge-base" element={<KnowledgeBase />} />
                  <Route path="/channels" element={<Channels />} />
                  <Route path="/surveys" element={<Surveys />} />
                  <Route path="/bots" element={<Bots />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/api-keys" element={<ApiKeys />} />
                  <Route path="/message-templates" element={<MessageTemplates />} />
                  <Route path="/tickets" element={<Tickets />} />
                  <Route path="/broadcasts" element={<Broadcasts />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
