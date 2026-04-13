import logoImage from '../assets/logo.png'
import '../css/register.css'

type RoleCardProps = {
  title: string
  subtitle: string
  buttonClassName: string
}

function GoogleIcon() {
  return (
    <svg className="social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.47a5.54 5.54 0 0 1-2.4 3.64v3h3.88c2.27-2.1 3.54-5.2 3.54-8.67z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.93l-3.88-3c-1.08.73-2.46 1.16-4.07 1.16-3.13 0-5.78-2.12-6.73-4.97H1.26v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.26A7.2 7.2 0 0 1 4.9 12c0-.79.13-1.55.37-2.26V6.64H1.26A12 12 0 0 0 0 12c0 1.93.46 3.76 1.26 5.36l4.01-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.8l3.43-3.43C17.96 1.25 15.24 0 12 0A12 12 0 0 0 1.26 6.64l4.01 3.1C6.22 6.89 8.87 4.77 12 4.77z"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg className="social-icon" viewBox="0 0 384 512" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M318.7 268.7c-.2-36.7 16.3-64.4 50.3-85-18.9-27-47.8-41.9-86-44.9-36-2.8-75.2 21-89.6 21-15.4 0-50-20-77.3-20.1-56.4.9-116.1 45.1-116.1 137.9 0 27.4 5 55.7 15 85 13.4 38.6 61.8 133.2 112.3 131.7 26.4-.6 45.1-18.8 79.5-18.8 33.4 0 50.8 18.8 80.2 18.8 51-.7 94.8-86.7 107.6-125.4-79.7-37.6-75.9-109.2-76-111.2zM260.4 103.6c27.7-33 25.1-63.1 24.3-74.6-24.5 1.4-52.8 16.7-68.9 35.4-17.8 20.1-28.3 44.8-26 73.1 26.8 2.1 50.3-11.5 70.6-33.9z"
      />
    </svg>
  )
}

function RoleCard({ title, subtitle, buttonClassName }: RoleCardProps) {
  return (
    <article className="register-card">
      <h2 className="register-card-title">{title}</h2>
      <p className="register-card-subtitle">{subtitle}</p>

      <form className="register-form" onSubmit={(event) => event.preventDefault()}>
        <label className="register-field">
          <span>Email</span>
          <input type="email" name="email" placeholder="nome@email.it" required />
        </label>
        <label className="register-field">
          <span>Password</span>
          <input type="password" name="password" placeholder="Inserisci password" required />
        </label>

        <button className={`register-action ${buttonClassName}`} type="submit">
          Registrati con Email
        </button>
      </form>

      <div className="register-divider" aria-hidden="true">
        <span>oppure</span>
      </div>

      <div className="social-actions">
        <button className="social-btn" type="button" aria-label="Registrati con Google">
          <GoogleIcon />
          Registrati con Google
        </button>
        <button className="social-btn" type="button" aria-label="Registrati con Apple">
          <AppleIcon />
          Registrati con Apple
        </button>
      </div>
    </article>
  )
}

export default function RegisterPage() {
  return (
    <main className="register-shell">
      <section className="register-hero" aria-label="Registrazione Coccole Bestiali">
        <div className="register-topbar">
          <a href="/" className="register-brand-link" aria-label="Torna alla home">
            <img src={logoImage} className="register-logo" alt="Coccole Bestiali" />
          </a>
          <header className="register-header">
            <a className="register-home-link" href="/">
              Torna alla Home
            </a>
          </header>
        </div>

        <section className="register-grid">
          <RoleCard
            title="Registrazione Pet Owner"
            subtitle="Trova il supporto perfetto per il tuo pet con un profilo in pochi passaggi."
            buttonClassName="is-owner"
          />
          <RoleCard
            title="Registrazione Pet Assistant"
            subtitle="Entra nel network professionale e inizia a ricevere richieste qualificate."
            buttonClassName="is-assistant"
          />
        </section>
      </section>
    </main>
  )
}
