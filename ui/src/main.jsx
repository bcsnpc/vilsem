import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// Design-system styles — imported here (not via @import in index.css, which CSS
// requires to precede all other rules) so they reliably bundle and apply.
import './ui/tokens.css'
import './ui/components.css'
import { initTheme } from './ui/theme.js'
import { ToastProvider } from './ui/Toast.jsx'

// Apply the saved (or default light) chrome theme before first paint.
initTheme()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
)
