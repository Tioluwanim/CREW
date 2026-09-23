import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import './index.css'
import App from './App.tsx'

// Global Framer Motion setting: every motion.* animation across the app
// (Copilot, onboarding, cost-verification transitions, etc.) automatically
// respects the OS-level "reduce motion" preference from here on, without
// each component having to check it individually.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
)
