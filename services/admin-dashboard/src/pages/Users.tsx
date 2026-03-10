import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useLanguageStore } from '../store/language'
import { Users as UsersIcon, Plus, Edit2, Trash2, Shield, Mail, User, X, Check } from 'lucide-react'

interface User {
  id: string
  email: string
  name: string | null
  role: string
  is_active: boolean
  created_at: string
}

const roleLabels: Record<string, string> = {
  owner: '擁有者',
  admin: '管理員',
  agent: '客服',
  viewer: '檢視者',
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({ email: '', password: '', name: '', role: 'agent' })
  const { t } = useLanguageStore()

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await api.get('/users')
      setUsers(response.data || [])
    } catch (error) {
      console.error('Failed to load users', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, {
          name: formData.name,
          role: formData.role,
        })
      } else {
        await api.post('/users', formData)
      }
      setShowModal(false)
      setEditingUser(null)
      setFormData({ email: '', password: '', name: '', role: 'agent' })
      loadUsers()
    } catch (error: any) {
      alert(error.response?.data?.message || '操作失敗')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此使用者嗎？')) return
    try {
      await api.delete(`/users/${id}`)
      loadUsers()
    } catch (error) {
      alert('刪除失敗')
    }
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setFormData({ email: user.email, password: '', name: user.name || '', role: user.role })
    setShowModal(true)
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('teamMembers') || '團隊成員'}</h1>
          <p className="text-gray-500 mt-1">{t('manageTeamMembers') || '管理團隊成員和權限'}</p>
        </div>
        <button
          onClick={() => { setEditingUser(null); setFormData({ email: '', password: '', name: '', role: 'agent' }); setShowModal(true) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          {t('addUser') || '新增使用者'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">載入中...</div>
      ) : (
        <div className="bg-white rounded-apple-xl shadow-apple-lg overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('user') || '使用者'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('role') || '角色'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('status') || '狀態'}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('createdAt') || '建立時間'}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('actions') || '操作'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <User size={20} className="text-primary-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{user.name || '-'}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      user.role === 'owner' ? 'bg-purple-100 text-purple-700' :
                      user.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                      user.role === 'agent' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      <Shield size={14} />
                      {roleLabels[user.role] || user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {user.is_active ? t('active') || '啟用' : t('inactive') || '停用'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openEditModal(user)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      <Edit2 size={18} />
                    </button>
                    {user.role !== 'owner' && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg ml-1"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {users.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {t('noUsers') || '尚無使用者'}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-apple-xl shadow-apple-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingUser ? (t('editUser') || '編輯使用者') : (t('addUser') || '新增使用者')}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('email') || 'Email'}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingUser}
                  className="input-field disabled:bg-gray-100"
                  required
                />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('password') || '密碼'}</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input-field"
                    required={!editingUser}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('name') || '姓名'}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('role') || '角色'}</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="input-field"
                >
                  <option value="admin">{t('admin') || '管理員'}</option>
                  <option value="agent">{t('agent') || '客服'}</option>
                  <option value="viewer">{t('viewer') || '檢視者'}</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  {t('cancel') || '取消'}
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {t('save') || '儲存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
