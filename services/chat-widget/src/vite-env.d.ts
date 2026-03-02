/// <reference types="vite/client" />

interface Window {
  OmniBotWidget?: {
    init: (config: { apiKey: string; position?: 'bottom-right' | 'bottom-left' }) => void
  }
}
