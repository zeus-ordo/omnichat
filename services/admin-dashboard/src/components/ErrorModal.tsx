import { AlertTriangle, X } from 'lucide-react'

export default function ErrorModal({
  open,
  title = '發生錯誤',
  message,
  onClose,
}: {
  open: boolean
  title?: string
  message: string
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black/45 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-red-100 overflow-hidden">
        <div className="px-5 py-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle size={18} />
            <h3 className="font-semibold">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-red-100 text-red-700">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 text-sm text-gray-700 whitespace-pre-wrap">{message}</div>
        <div className="px-5 pb-4 flex justify-end">
          <button className="btn-primary" onClick={onClose}>知道了</button>
        </div>
      </div>
    </div>
  )
}
