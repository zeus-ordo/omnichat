import React from 'react'
import ReactDOM from 'react-dom/client'
import Widget from './Widget'

// Auto-initialize with default config
const root = document.getElementById('omnibot-widget-root')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Widget apiKey="demo_api_key_12345" />
    </React.StrictMode>
  )
}

export default function initWidget(config: { apiKey: string; position?: 'bottom-right' | 'bottom-left' }) {
  const root = document.getElementById('omnibot-widget-root')
  if (root) {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <Widget {...config} />
      </React.StrictMode>
    )
  }
}

// Make available globally
;(window as any).OmniBotWidget = { init: initWidget }
