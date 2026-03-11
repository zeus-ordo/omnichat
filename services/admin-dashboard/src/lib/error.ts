export function getErrorMessage(error: any, fallback = '操作失敗，請稍後再試。'): string {
  const message = error?.response?.data?.message

  if (Array.isArray(message)) {
    return message.join('\n')
  }

  if (typeof message === 'string' && message.trim().length > 0) {
    return message
  }

  if (typeof error?.message === 'string' && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}
