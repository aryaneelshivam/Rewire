import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './components/arc/foundation.css'
import './index.css'
import Root from './auth/AuthGate.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
