import { useEffect, useState } from 'react'

const PORTAL_USER_STORAGE_KEY = 'cb_portal_user'

type RemoveAccountModalProps = {
  onClose: () => void
  onError: (message: string) => void
}

export default function RemoveAccountModal({ onClose, onError }: RemoveAccountModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDeleting) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDeleting, onClose])

  async function handleRemoveAccount() {
    if (isDeleting) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch('/api/auth/account', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
        },
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Non è stato possibile rimuovere l’account. Riprova.')
      }

      window.localStorage.removeItem(PORTAL_USER_STORAGE_KEY)
      window.location.assign('/')
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Non è stato possibile rimuovere l’account. Riprova.'
      onError(message)
      setIsDeleting(false)
    }
  }

  return (
    <div
      className="profile-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-account-title"
    >
      <section className="profile-remove-account-modal">
        <div className="profile-modal-head">
          <div>
            <span className="profile-remove-account-kicker">OPERAZIONE IRREVERSIBILE</span>
            <h2 id="remove-account-title" className="profile-modal-title">Rimuovi account?</h2>
          </div>
          <button
            type="button"
            className="profile-modal-close"
            aria-label="Chiudi conferma rimozione account"
            onClick={onClose}
            disabled={isDeleting}
          >
            ×
          </button>
        </div>

        <div className="profile-remove-account-warning">
          <span className="profile-remove-account-warning-icon" aria-hidden="true">!</span>
          <p>
            Rimuovendo l’account perderai definitivamente tutti i dati memorizzati fino a questo momento.
            L’account sarà completamente rimosso insieme a profilo, file, foto, documenti, servizi e
            disponibilità. Questa operazione non può essere annullata.
          </p>
        </div>

        <div className="profile-modal-actions">
          <button
            type="button"
            className="profile-modal-button is-secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Annulla
          </button>
          <button
            type="button"
            className="profile-modal-button is-danger"
            onClick={() => void handleRemoveAccount()}
            disabled={isDeleting}
          >
            {isDeleting ? 'Rimozione in corso...' : 'Rimuovi definitivamente'}
          </button>
        </div>
      </section>
    </div>
  )
}
