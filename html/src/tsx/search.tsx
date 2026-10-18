import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../css/index.css'
import PetAssistantSearchPage from '../pages/PetAssistantSearchPage.tsx'

createRoot(document.getElementById('search-root')!).render(
  <StrictMode>
    <PetAssistantSearchPage />
  </StrictMode>,
)
