import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../css/index.css'
import ProfilePlaceholderPage from '../pages/ProfilePlaceholderPage.tsx'

createRoot(document.getElementById('profile-petassistant-root')!).render(
  <StrictMode>
    <ProfilePlaceholderPage />
  </StrictMode>,
)
