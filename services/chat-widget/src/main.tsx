import React from 'react'
import ReactDOM from 'react-dom/client'
import Widget from './Widget'

type WidgetInitConfig = {
  apiKey: string
  position?: 'bottom-right' | 'bottom-left'
  authToken?: string
}

// Auto-initialize with default config
const root = document.getElementById('omnibot-widget-root')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Widget apiKey="demo_api_key_12345" />
    </React.StrictMode>
  )
}

export default function initWidget(config: WidgetInitConfig) {
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
