import './App.css'
import animaliImage from './assets/animali.png'
import logoImage from './assets/logo.png'
import { useEffect, useState } from 'react'
import { areRequiredFieldsFilled, sanitizeText, validateEmail } from './utility.js'

function App() {
  const currentYear = new Date().getFullYear()
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'error' | 'success'>('error')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    msg: '',
  })

  useEffect(() => {
    if (!toastMessage) {
      return
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [toastMessage])

  function showToast(message: string, type: 'error' | 'success') {
    setToastMessage(message)
    setToastType(type)
  }

  function resetForm() {
    setFormData({
      name: '',
      email: '',
      msg: '',
    })
  }

  return (
    <main className="home-shell">
      <section className="hero-card" aria-label="Banner principale">
        <div className="hero-layout">
          <div className="hero-left">
            <img className="hero-logo" src={logoImage} alt="Logo Coccole Bestiali" />
            <img
              className="hero-animals"
              src={animaliImage}
              alt="Cani e gatti felici nel servizio Coccole Bestiali"
            />
          </div>
          <div className="hero-right">
            <img className="hero-logo-mobile-top" src={logoImage} alt="Logo Coccole Bestiali" />
            <div className="hero-right-panel">
              <div className="hero-topstrip">
                <a
                  className="email-link"
                  href="mailto:info@coccolebestiali.it"
                  onClick={(event) => {
                    event.preventDefault()
                    setIsInfoModalOpen(true)
                  }}
                >
                  info@coccolebestiali.it
                </a>
                <nav className="top-actions" aria-label="Azioni rapide">
                  <a className="action ghost" href="#">
                    Accedi
                  </a>
                  <a className="action solid" href="/register.html">
                    Registrati
                  </a>
                </nav>
              </div>
              <section className="hero-cta" aria-label="Call to action principale">
                <p className="hero-kicker">SERVIZI PROFESSIONALI PER ANIMALI DOMESTICI</p>
                <h1 className="hero-title">Trova la coccola perfetta per il tuo pet</h1>
                <p className="hero-subtitle">
                  Assistenza affidabile, stile professionale, atmosfera accogliente.
                </p>
                <div className="hero-cta-actions">
                  <a className="cta-btn cta-primary" href="#">
                    Cerca Un Pet Assistant
                  </a>
                  <a className="cta-btn cta-secondary" href="#">
                    Diventa Pet Assistant
                  </a>
                </div>
              </section>
              <footer className="hero-legal" aria-label="Informazioni legali">
                <small>© {currentYear} Coccole Bestiali. Tutti i diritti riservati.</small>
                <a
                  href="https://www.iubenda.com"
                  className="hero-privacy-link"
                  aria-label="Privacy Policy - iubenda"
                  target="_blank"
                  rel="noreferrer"
                >
                  Privacy Policy
                </a>
              </footer>
            </div>
          </div>
        </div>
      </section>

      {isInfoModalOpen ? (
        <div
          className="info-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Richiedi informazioni"
          onClick={() => setIsInfoModalOpen(false)}
        >
          <div className="info-modal" onClick={(event) => event.stopPropagation()}>
            <h2 className="info-modal-title">Richiedi informazioni</h2>
            <p className="info-modal-subtitle">
              Compila il modulo e ti risponderemo al piu presto.
            </p>
            <form
              className="info-modal-form"
              noValidate
              onSubmit={async (event) => {
                event.preventDefault()

                const payload = {
                  name: sanitizeText(formData.name),
                  email: sanitizeText(formData.email),
                  msg: sanitizeText(formData.msg),
                }

                if (!areRequiredFieldsFilled(payload)) {
                  showToast('Alcuni campi obbligatori non sono stati popolati.', 'error')
                  return
                }

                if (!validateEmail(payload.email)) {
                  showToast('Indirizzo email errato.', 'error')
                  return
                }

                try {
                  setIsSubmitting(true)

                  const response = await fetch('/api/messages', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Accept: 'application/json',
                    },
                    body: JSON.stringify(payload),
                  })

                  if (!response.ok) {
                    throw new Error('Errore API')
                  }

                  setIsInfoModalOpen(false)
                  resetForm()
                  showToast('Richiesta inviata con successo.', 'success')
                } catch {
                  showToast('Errore in fase di Invio. Si prega di riprovare.', 'error')
                } finally {
                  setIsSubmitting(false)
                }
              }}
            >
              <label className="info-field">
                <span>Nome</span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label className="info-field">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </label>
              <label className="info-field">
                <span>Messaggio</span>
                <textarea
                  name="message"
                  rows={4}
                  value={formData.msg}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, msg: event.target.value }))
                  }
                />
              </label>
              <p className="info-required-note">Tutti i campi obbligatori.</p>
              <div className="info-modal-actions">
                <button
                  type="button"
                  className="info-btn info-btn-cancel"
                  disabled={isSubmitting}
                  onClick={() => setIsInfoModalOpen(false)}
                >
                  Annulla
                </button>
                <button type="submit" className="info-btn info-btn-submit" disabled={isSubmitting}>
                  Invia richiesta
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className={`info-toast ${toastType === 'error' ? 'is-error' : 'is-success'}`}>
          {toastMessage}
        </div>
      ) : null}
    </main>
  )
}

export default App
