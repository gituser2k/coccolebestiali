import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const openInfoModal = () => {
    setIsModalOpen(true)
    setIsSent(false)
  }

  const closeInfoModal = () => {
    setIsModalOpen(false)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSent(true)
    event.currentTarget.reset()
  }

  useEffect(() => {
    if (!isModalOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeInfoModal()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isModalOpen])

  return (
    <main className="home-shell">
      <header className="topbar" aria-label="Barra principale">
        <button
          className="brand email-trigger"
          type="button"
          aria-label="Apri modulo richiesta informazioni"
          onClick={openInfoModal}
        >
          <span className="brand-mark">@</span>
          <span className="brand-text">info@coccolebestiali.it</span>
        </button>
        <nav className="top-actions" aria-label="Azioni rapide">
          <a className="action ghost" href="/demo.html">
            Accedi
          </a>
          <a className="action solid" href="#">
            Registrati
          </a>
        </nav>
      </header>

      <section className="hero-card" aria-label="Banner principale">
        <img
          className="hero-image"
          src="/asset/banner.svg"
          alt="Cani e gatti felici nel servizio Coccole Bestiali"
        />
        <div className="hero-overlay">
          <p className="kicker">Servizi professionali per animali domestici</p>
          <h1>Trova la coccola perfetta per il tuo pet</h1>
          <p className="lead">
            Assistenza affidabile, stile premium, atmosfera accogliente.
          </p>
          <div className="cta-row">
            <a className="action solid" href="#">
              Cerca Un Petassistant
            </a>
            <a className="action ghost" href="#">
              Diventa Petassistant
            </a>
          </div>
        </div>
      </section>

      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeInfoModal}>
          <section
            className="info-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Richiesta informazioni"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h2>Richiedi informazioni</h2>
              <button
                className="modal-close"
                type="button"
                aria-label="Chiudi modale"
                onClick={closeInfoModal}
              >
                ×
              </button>
            </div>

            <p className="modal-subtitle">
              Compila il modulo e ti risponderemo al piu presto.
            </p>

            <form className="info-form" onSubmit={handleSubmit}>
              <label>
                Nome
                <input type="text" name="name" required />
              </label>

              <label>
                Email
                <input type="email" name="email" required />
              </label>

              <label>
                Messaggio
                <textarea name="message" rows={4} required />
              </label>

              <button className="action solid" type="submit">
                Invia richiesta
              </button>

              {isSent && <p className="success-note">Richiesta inviata con successo.</p>}
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
