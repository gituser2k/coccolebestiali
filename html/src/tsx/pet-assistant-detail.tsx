import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../css/index.css'
import PublicPetAssistantPage from '../pages/PublicPetAssistantPage'

createRoot(document.getElementById('pet-assistant-detail-root')!).render(
  <StrictMode>
    <PublicPetAssistantPage />
  </StrictMode>,
)
