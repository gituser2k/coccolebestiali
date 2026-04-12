import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../css/index.css'
import RegisterPage from '../pages/RegisterPage.tsx'

createRoot(document.getElementById('register-root')!).render(
  <StrictMode>
    <RegisterPage />
  </StrictMode>,
)
