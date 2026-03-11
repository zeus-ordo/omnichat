import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useLanguageStore } from '../store/language'
import { FileText, Upload, CheckCircle, XCircle, Loader } from 'lucide-react'
import ErrorModal from '../components/ErrorModal'
import { getErrorMessage } from '../lib/error'

export default function KnowledgeBase() {
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const { t } = useLanguageStore()

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      const response = await api.get('/documents')
      setDocuments(response.data || [])
    } catch (error) {
      setError(getErrorMessage(error, '讀取知識庫失敗'))
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name)
      formData.append('type', file.name.split('.').pop() || 'txt')

      // In real implementation, upload to storage first
      await api.post('/documents', {
        name: file.name,
        type: file.name.split('.').pop(),
        file_url: `https://storage.example.com/${file.name}`,
      })
      
      await loadDocuments()
    } catch (error) {
      setError(getErrorMessage(error, '上傳知識庫失敗'))
    } finally {
      setUploading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="text-green-500" size={16} />
      case 'processing':
        return <Loader className="text-yellow-500 animate-spin" size={16} />
      case 'error':
        return <XCircle className="text-red-500" size={16} />
      default:
        return <XCircle className="text-gray-400" size={16} />
    }
  }

  return (
    <>
      <div className="page-shell">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="page-header-title">{t('knowledgeBase')}</h1>
        <label className="btn-primary cursor-pointer flex items-center gap-2">
          <Upload size={20} />
          {uploading ? t('uploading') : t('uploadDocument')}
          <input
            type="file"
            className="hidden"
            onChange={handleUpload}
            accept=".pdf,.doc,.docx,.txt"
            disabled={uploading}
          />
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <p className="text-sm text-gray-500">
            {t('supportedFormatsPdf')}
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">{t('loading')}</div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText size={48} className="mx-auto mb-4 text-gray-300" />
            <p>{t('noDocumentsUploaded')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {documents.map((doc) => (
              <div key={doc.id} className="p-4 flex items-center gap-4">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <FileText size={20} className="text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.name}</p>
                  <p className="text-sm text-gray-500">
                    {doc.type} • {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(doc.status)}
                  <span className="text-sm text-gray-500 capitalize">{doc.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ErrorModal
        open={Boolean(error)}
        title="知識庫操作失敗"
        message={error}
        onClose={() => setError('')}
      />
    </>
  )
}
