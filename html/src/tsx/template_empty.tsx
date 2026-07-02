import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../css/index.css'
import TemplateEmptyPage from '../pages/TemplateEmptyPage.tsx'

createRoot(document.getElementById('template-empty-root')!).render(
  <StrictMode>
    <TemplateEmptyPage />
  </StrictMode>,
)
