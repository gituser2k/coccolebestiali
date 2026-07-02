import logoImage from '../assets/logo.png'
import '../css/template_empty.css'

export default function TemplateEmptyPage() {
  return (
    <main className="register-shell">
      <section className="register-hero" aria-label="Template vuoto Coccole Bestiali">
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

        <section className="register-grid"></section>
      </section>
    </main>
  )
}
