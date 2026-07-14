import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../css/index.css'
import PetOwnerProfilePage from '../pages/PetOwnerProfilePage.tsx'

createRoot(document.getElementById('profile-petowner-root')!).render(
  <StrictMode>
    <PetOwnerProfilePage />
  </StrictMode>,
)
