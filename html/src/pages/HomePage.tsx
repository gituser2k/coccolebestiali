import '../css/home.css'
import animaliImage from '../assets/animali.png'
import logoImage from '../assets/logo.png'
import { useEffect, useRef, useState } from 'react'
import { areRequiredFieldsFilled, sanitizeText, validateEmail } from '../utility.js'

const PORTAL_USER_STORAGE_KEY = 'cb_portal_user'
const GENERIC_AUTH_ERROR_MESSAGE = 'Si è verificato un errore. Riprova più tardi.'
const TECHNICAL_AUTH_MESSAGES = new Set([
  'Configurazione autenticazione non disponibile.',
  'Google non disponibile su questo browser. Riprova o usa Email.',
  'SDK Google non disponibile.',
  'SDK Apple non disponibile.',
  'Config Apple non completa (clientId / redirectURI).',
  'Token Apple non disponibile.',
  'GOOGLE_CLIENT_ID non configurato nel backend.',
])

type PublicAuthConfig = {
  googleClientId: string
  appleClientId: string
  appleRedirectUri: string
  appleMockAuth: boolean
}

type PortalUser = {
  id: number
  role: string
  name: string
  email: string
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (params: {
            client_id: string
            callback: (response: { credential?: string }) => void
          }) => void
          prompt: (callback?: (notification: { isNotDisplayed?: () => boolean }) => void) => void
        }
        oauth2?: {
          initTokenClient: (params: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; error?: string }) => void
          }) => {
            requestAccessToken: (params?: { prompt?: string }) => void
          }
        }
      }
    }
    AppleID?: {
      auth?: {
        init: (params: {
          clientId: string
          scope: string
          redirectURI: string
          usePopup: boolean
        }) => void
        signIn: () => Promise<{
          authorization?: {
            id_token?: string
          }
          user?: unknown
        }>
      }
    }
  }
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

function HomePage() {
  const currentYear = new Date().getFullYear()
  const [authConfig, setAuthConfig] = useState<PublicAuthConfig>({
    googleClientId: '',
    appleClientId: '',
    appleRedirectUri: '',
    appleMockAuth: false,
  })
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false)
  const [isLoginPanelOpen, setIsLoginPanelOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoginBusy, setIsLoginBusy] = useState(false)
  const [isLogoutBusy, setIsLogoutBusy] = useState(false)
  const [currentUser, setCurrentUser] = useState<PortalUser | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'error' | 'success'>('error')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    msg: '',
  })
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  })
  const googleTokenClientRef = useRef<{ requestAccessToken: (params?: { prompt?: string }) => void } | null>(null)
  const googleIdInitializedRef = useRef(false)

  useEffect(() => {
    if (!toastMessage) {
      return
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [toastMessage])

  useEffect(() => {
    void loadAuthConfig()
    void loadCurrentUser()
  }, [])

  useEffect(() => {
    if (!authConfig.googleClientId) {
      return
    }

    ensureGoogleClientsInitialized()

    if (googleIdInitializedRef.current && googleTokenClientRef.current) {
      return
    }

    const timer = window.setInterval(() => {
      const ready = ensureGoogleClientsInitialized()
      if (ready && googleTokenClientRef.current) {
        window.clearInterval(timer)
      }
    }, 250)

    return () => window.clearInterval(timer)
  }, [authConfig.googleClientId])

  function showToast(message: string, type: 'error' | 'success') {
    setToastMessage(message)
    setToastType(type)
  }

  function clearLoginStatus() {
  }

  async function reportTechnicalAuthError(context: string, message: string, details: Record<string, unknown> = {}) {
    try {
      await fetch('/api/auth/frontend-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          context,
          message,
          details,
        }),
      })
    } catch {
      // Avoid recursive UI noise if the logging call itself fails.
    }
  }

  async function handleGenericAuthTechnicalError(
    context: string,
    message: string,
    details: Record<string, unknown> = {}
  ) {
    clearLoginStatus()
    showToast(GENERIC_AUTH_ERROR_MESSAGE, 'error')
    await reportTechnicalAuthError(context, message, details)
  }

  function normalizePortalUser(user: unknown): PortalUser | null {
    if (!user || typeof user !== 'object') {
      return null
    }

    const candidate = user as Record<string, unknown>
    const id = Number(candidate.id ?? 0)
    const role = sanitizeText(candidate.role ?? '')
    const name = sanitizeText(candidate.name ?? '')
    const email = sanitizeText(candidate.email ?? '')

    if (id <= 0) {
      return null
    }

    return { id, role, name, email }
  }

  function persistCurrentUser(user: unknown) {
    const normalizedUser = normalizePortalUser(user)
    setCurrentUser(normalizedUser)

    if (typeof window === 'undefined') {
      return
    }

    if (!user || typeof user !== 'object') {
      window.localStorage.removeItem(PORTAL_USER_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(PORTAL_USER_STORAGE_KEY, JSON.stringify(user))
  }

  function clearPersistedUser() {
    setCurrentUser(null)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(PORTAL_USER_STORAGE_KEY)
    }
  }

  async function loadCurrentUser() {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        clearPersistedUser()
        return
      }

      persistCurrentUser(payload?.data?.user ?? null)
    } catch {
      clearPersistedUser()
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      email: '',
      msg: '',
    })
  }

  async function loadAuthConfig() {
    try {
      const response = await fetch('/api/auth/config', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('AUTH_CONFIG_ERROR')
      }

      const payload = await response.json()
      if (!payload?.ok) {
        throw new Error('AUTH_CONFIG_INVALID')
      }

      setAuthConfig({
        googleClientId: sanitizeText(payload?.data?.googleClientId ?? ''),
        appleClientId: sanitizeText(payload?.data?.appleClientId ?? ''),
        appleRedirectUri: sanitizeText(payload?.data?.appleRedirectUri ?? ''),
        appleMockAuth: Boolean(payload?.data?.appleMockAuth),
      })
    } catch {
      await handleGenericAuthTechnicalError('HomePage.loadAuthConfig', 'Configurazione autenticazione non disponibile.')
    }
  }

  function ensureGoogleClientsInitialized() {
    if (!authConfig.googleClientId || !window.google?.accounts) {
      return false
    }

    if (!googleIdInitializedRef.current && window.google.accounts.id) {
      window.google.accounts.id.initialize({
        client_id: authConfig.googleClientId,
        callback: async (response) => {
          if (!response?.credential) {
            return
          }

          await submitGoogleLogin(response.credential)
        },
      })
      googleIdInitializedRef.current = true
    }

    if (!googleTokenClientRef.current && window.google.accounts.oauth2) {
      googleTokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: authConfig.googleClientId,
        scope: 'openid email profile',
        callback: async (response) => {
          if (response?.error || !response?.access_token) {
            clearLoginStatus()
            showToast('Autenticazione Google annullata o non riuscita.', 'error')
            setIsLoginBusy(false)
            return
          }

          await submitGoogleLogin('', response.access_token)
        },
      })
    }

    return googleIdInitializedRef.current || Boolean(googleTokenClientRef.current)
  }

  async function postLogin(endpoint: string, body: Record<string, unknown>) {
    setIsLoginBusy(true)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Login non completato.')
      }

      persistCurrentUser(payload?.data?.user ?? null)
      setIsLoginPanelOpen(false)
      clearLoginStatus()
      showToast('Login completato. Reindirizzamento in corso...', 'success')
      window.setTimeout(() => {
        window.location.assign(payload?.data?.redirect || '/profile/petassistant')
      }, 220)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante il login.'
      if (TECHNICAL_AUTH_MESSAGES.has(message)) {
        await handleGenericAuthTechnicalError('HomePage.postLogin', message, { endpoint })
      } else {
        clearLoginStatus()
        showToast(message, 'error')
      }
      setIsLoginBusy(false)
    }
  }

  async function handleLogout() {
    try {
      setIsLogoutBusy(true)

      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        throw new Error('Logout non completato.')
      }

      clearPersistedUser()
      setIsLoginPanelOpen(false)
      showToast('Logout completato.', 'success')
    } catch {
      showToast('Si è verificato un errore. Riprova più tardi.', 'error')
    } finally {
      setIsLogoutBusy(false)
    }
  }

  const currentUserInitial = (() => {
    const source = sanitizeText(currentUser?.name || currentUser?.email || '')
    return source ? source.charAt(0).toUpperCase() : ''
  })()

  const currentUserProfilePath =
    currentUser?.role === 'pet_owner' ? '/profile/petowner?entry=login' : '/profile/petassistant?entry=login'

  async function handleCredentialLogin() {
    const email = sanitizeText(loginData.email)
    const password = loginData.password

    if (!validateEmail(email)) {
      clearLoginStatus()
      showToast('Indirizzo email errato.', 'error')
      return
    }

    if (!sanitizeText(password)) {
      clearLoginStatus()
      showToast('Inserisci la password.', 'error')
      return
    }

    await postLogin('/api/auth/login/email', {
      email,
      password,
    })
  }

  async function submitGoogleLogin(idToken: string, accessToken: string = '') {
    await postLogin('/api/auth/login/google', {
      idToken,
      accessToken,
    })
  }

  async function submitAppleLogin(identityToken: string, user: unknown) {
    await postLogin('/api/auth/login/apple', {
      identityToken,
      user,
    })
  }

  async function submitAppleMockLogin() {
    const mockEmail = sanitizeText(loginData.email).toLowerCase()

    if (!validateEmail(mockEmail)) {
      clearLoginStatus()
      showToast('Per Apple in locale inserisci prima l email registrata.', 'error')
      return
    }

    await postLogin('/api/auth/login/apple/mock', {
      mockEmail,
    })
  }

  async function handleGoogleLogin() {
    if (!authConfig.googleClientId) {
      await handleGenericAuthTechnicalError(
        'HomePage.handleGoogleLogin',
        'GOOGLE_CLIENT_ID non configurato nel backend.'
      )
      return
    }

    if (!window.google?.accounts) {
      await handleGenericAuthTechnicalError('HomePage.handleGoogleLogin', 'SDK Google non disponibile.')
      return
    }

    setIsLoginBusy(true)

    ensureGoogleClientsInitialized()

    if (googleTokenClientRef.current) {
      googleTokenClientRef.current.requestAccessToken({ prompt: 'select_account' })
      return
    }

    if (!window.google.accounts.id) {
      await handleGenericAuthTechnicalError('HomePage.handleGoogleLogin', 'SDK Google non disponibile.')
      setIsLoginBusy(false)
      return
    }

    window.google.accounts.id.prompt((notification) => {
      if (notification?.isNotDisplayed?.()) {
        setIsLoginBusy(false)
        void handleGenericAuthTechnicalError(
          'HomePage.handleGoogleLogin',
          'Google non disponibile su questo browser. Riprova o usa Email.'
        )
      }
    })
  }

  async function handleAppleLogin() {
    if (authConfig.appleMockAuth) {
      await submitAppleMockLogin()
      return
    }

    if (!authConfig.appleClientId || !authConfig.appleRedirectUri) {
      await handleGenericAuthTechnicalError(
        'HomePage.handleAppleLogin',
        'Config Apple non completa (clientId / redirectURI).'
      )
      return
    }

    if (!window.AppleID?.auth) {
      await handleGenericAuthTechnicalError('HomePage.handleAppleLogin', 'SDK Apple non disponibile.')
      return
    }

    setIsLoginBusy(true)

    try {
      window.AppleID.auth.init({
        clientId: authConfig.appleClientId,
        scope: 'name email',
        redirectURI: authConfig.appleRedirectUri,
        usePopup: true,
      })

      const response = await window.AppleID.auth.signIn()
      const identityToken = response?.authorization?.id_token ?? ''

      if (!identityToken) {
        throw new Error('Token Apple non disponibile.')
      }

      await submitAppleLogin(identityToken, response?.user ?? null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore autenticazione Apple.'
      if (message === 'Token Apple non disponibile.') {
        await handleGenericAuthTechnicalError('HomePage.handleAppleLogin', message)
      } else {
        clearLoginStatus()
        showToast(message, 'error')
      }
      setIsLoginBusy(false)
    }
  }

  function renderCredentialLogin() {
    return (
      <section className="hero-login-panel" aria-label="Pannello di login">
        <h2 className="hero-login-title">Accedi al tuo profilo</h2>
        <p className="hero-login-subtitle">
          Inserisci le tue credenziali oppure utilizza il provider che preferisci.
        </p>

        <form
          className="hero-login-form"
          onSubmit={(event) => {
            event.preventDefault()
            void handleCredentialLogin()
          }}
        >
          <label className="hero-login-field">
            <span>Email</span>
            <input
              type="email"
              name="login-email"
              placeholder="nome@email.it"
              value={loginData.email}
              onChange={(event) =>
                setLoginData((current) => ({ ...current, email: event.target.value }))
              }
            />
          </label>
          <label className="hero-login-field">
            <span>Password</span>
            <input
              type="password"
              name="login-password"
              placeholder="Inserisci password"
              value={loginData.password}
              onChange={(event) =>
                setLoginData((current) => ({ ...current, password: event.target.value }))
              }
            />
          </label>

          <button
            className="hero-login-action hero-login-primary"
            type="submit"
            disabled={isLoginBusy}
          >
            Login con credenziali
          </button>
        </form>

        <div className="hero-login-divider" aria-hidden="true">
          <span>oppure</span>
        </div>

        <div className="hero-login-socials">
          <button
            className="hero-login-social-btn"
            type="button"
            aria-label="Login con Google"
            disabled={isLoginBusy}
            onClick={() => void handleGoogleLogin()}
          >
            <GoogleIcon />
            Login con Google
          </button>
          <button
            className="hero-login-social-btn"
            type="button"
            aria-label="Login con Apple"
            disabled={isLoginBusy}
            onClick={() => void handleAppleLogin()}
          >
            <AppleIcon />
            Login con Apple
          </button>
        </div>

      </section>
    )
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
                  {currentUser ? (
                    <>
                      <a
                        className="user-initial-badge"
                        href={currentUserProfilePath}
                        aria-label={`Apri il profilo di ${currentUser.name || currentUser.email}`}
                        title={currentUser.name || currentUser.email}
                      >
                        {currentUserInitial}
                      </a>
                      <button
                        className="action ghost"
                        type="button"
                        disabled={isLogoutBusy}
                        onClick={() => {
                          void handleLogout()
                        }}
                      >
                        Logout
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="action ghost"
                        type="button"
                        onClick={() => {
                          setIsLoginPanelOpen(true)
                          clearLoginStatus()
                        }}
                      >
                        Accedi
                      </button>
                      <a className="action solid" href="/register">
                        Registrati
                      </a>
                    </>
                  )}
                </nav>
              </div>
              {isLoginPanelOpen ? (
                renderCredentialLogin()
              ) : (
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
              )}
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

export default HomePage
