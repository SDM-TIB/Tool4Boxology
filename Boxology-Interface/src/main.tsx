import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './components/Toast/ToastProvider'
import { DialogsProvider } from './hooks/useDialogs'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <DialogsProvider>
        <App />
      </DialogsProvider>
    </ToastProvider>
  </StrictMode>,
)
