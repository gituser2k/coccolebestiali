import logoImage from '../assets/logo.png'
import '../css/register.css'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { sanitizeText, validateEmail } from '../utility.js'

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

type RoleCardProps = {
  role: 'pet_owner' | 'pet_assistant'
  title: string
  subtitle: string
  buttonClassName: string
  isBusy: boolean
  onSubmitEmail: (role: 'pet_owner' | 'pet_assistant', email: string, password: string) => Promise<void>
  onClickGoogle: (role: 'pet_owner' | 'pet_assistant') => Promise<void>
  onClickApple: (role: 'pet_owner' | 'pet_assistant') => Promise<void>
}

type PublicAuthConfig = {
  googleClientId: string
  appleClientId: string
  appleRedirectUri: string
  appleMockAuth: boolean
}

type PasswordChecks = {
  minLength: boolean
  uppercase: boolean
  lowercase: boolean
  number: boolean
  symbol: boolean
  noSpaces: boolean
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

function getPasswordChecks(password: string): PasswordChecks {
  return {
    minLength: password.length >= 10,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9\s]/.test(password),
    noSpaces: !/\s/.test(password),
  }
}

function getPasswordValidationMessage(password: string): string {
  const checks = getPasswordChecks(password)
  const isValid = Object.values(checks).every(Boolean)

  if (isValid) {
    return ''
  }

  return 'La password deve contenere almeno 10 caratteri, una maiuscola, una minuscola, un numero, un simbolo e nessuno spazio.'
}

function RoleCard({
  role,
  title,
  subtitle,
  buttonClassName,
  isBusy,
  onSubmitEmail,
  onClickGoogle,
  onClickApple,
}: RoleCardProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const passwordChecks = getPasswordChecks(password)
  const hasPasswordInput = password.length > 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmitEmail(role, email, password)
  }

  return (
    <article className="register-card">
      <h2 className="register-card-title">{title}</h2>
      <p className="register-card-subtitle">{subtitle}</p>

      <form className="register-form" onSubmit={handleSubmit}>
        <label className="register-field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            placeholder="nome@email.it"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="register-field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            placeholder="Inserisci password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="password-guidance" aria-live="polite">
            <strong className="password-guidance-title">La password deve contenere:</strong>
            <div className="password-rule-list">
              <span className={`password-rule ${passwordChecks.minLength ? 'is-valid' : hasPasswordInput ? 'is-invalid' : ''}`}>10+ caratteri</span>
              <span className={`password-rule ${passwordChecks.uppercase ? 'is-valid' : hasPasswordInput ? 'is-invalid' : ''}`}>1 maiuscola</span>
              <span className={`password-rule ${passwordChecks.lowercase ? 'is-valid' : hasPasswordInput ? 'is-invalid' : ''}`}>1 minuscola</span>
              <span className={`password-rule ${passwordChecks.number ? 'is-valid' : hasPasswordInput ? 'is-invalid' : ''}`}>1 numero</span>
              <span className={`password-rule ${passwordChecks.symbol ? 'is-valid' : hasPasswordInput ? 'is-invalid' : ''}`}>1 simbolo</span>
              <span className={`password-rule ${passwordChecks.noSpaces ? 'is-valid' : hasPasswordInput ? 'is-invalid' : ''}`}>nessuno spazio</span>
            </div>
          </div>
        </label>

        <button className={`register-action ${buttonClassName}`} type="submit" disabled={isBusy}>
          Registrati con Email
        </button>
      </form>

      <div className="register-divider" aria-hidden="true">
        <span>oppure</span>
      </div>

      <div className="social-actions">
        <button
          className="social-btn"
          type="button"
          aria-label="Registrati con Google"
          disabled={isBusy}
          onClick={() => void onClickGoogle(role)}
        >
          <GoogleIcon />
          Registrati con Google
        </button>
        <button
          className="social-btn"
          type="button"
          aria-label="Registrati con Apple"
          disabled={isBusy}
          onClick={() => void onClickApple(role)}
        >
          <AppleIcon />
          Registrati con Apple
        </button>
      </div>
    </article>
  )
}

export default function RegisterPage() {
  const [authConfig, setAuthConfig] = useState<PublicAuthConfig>({
    googleClientId: '',
    appleClientId: '',
    appleRedirectUri: '',
    appleMockAuth: false,
  })
  const [busyRole, setBusyRole] = useState<'pet_owner' | 'pet_assistant' | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'error' | 'success'>('error')
  const pendingGoogleRoleRef = useRef<'pet_owner' | 'pet_assistant' | null>(null)
  const googleTokenClientRef = useRef<{ requestAccessToken: (params?: { prompt?: string }) => void } | null>(null)
  const googleIdInitializedRef = useRef(false)

  useEffect(() => {
    if (!toastMessage) {
      return
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [toastMessage])

  function persistCurrentUser(user: unknown) {
    if (typeof window === 'undefined' || !user || typeof user !== 'object') {
      return
    }

    window.localStorage.setItem(PORTAL_USER_STORAGE_KEY, JSON.stringify(user))
  }

  function setRoleStatus(_role: 'pet_owner' | 'pet_assistant', message: string, type: 'success' | 'error') {
    if (!message) {
      return
    }

    showToast(message, type)
  }

  function showToast(message: string, type: 'error' | 'success') {
    setToastMessage(message)
    setToastType(type)
  }

  async function reportTechnicalAuthError(
    context: string,
    message: string,
    details: Record<string, unknown> = {}
  ) {
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
    role: 'pet_owner' | 'pet_assistant',
    context: string,
    message: string,
    details: Record<string, unknown> = {}
  ) {
    setRoleStatus(role, '', 'error')
    showToast(GENERIC_AUTH_ERROR_MESSAGE, 'error')
    await reportTechnicalAuthError(context, message, { role, ...details })
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
      setRoleStatus('pet_owner', '', 'error')
      setRoleStatus('pet_assistant', '', 'error')
      showToast(GENERIC_AUTH_ERROR_MESSAGE, 'error')
      await reportTechnicalAuthError('RegisterPage.loadAuthConfig', 'Configurazione autenticazione non disponibile.')
    }
  }

  useEffect(() => {
    void loadAuthConfig()
  }, [])

  function ensureGoogleClientsInitialized() {
    if (!authConfig.googleClientId || !window.google?.accounts) {
      return false
    }

    if (!googleIdInitializedRef.current && window.google.accounts.id) {
      window.google.accounts.id.initialize({
        client_id: authConfig.googleClientId,
        callback: async (response) => {
          const role = pendingGoogleRoleRef.current
          if (!role || !response?.credential) {
            return
          }
          await submitGoogleRegistration(role, response.credential)
        },
      })
      googleIdInitializedRef.current = true
    }

    if (!googleTokenClientRef.current && window.google.accounts.oauth2) {
      googleTokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: authConfig.googleClientId,
        scope: 'openid email profile',
        callback: async (response) => {
          const role = pendingGoogleRoleRef.current
          if (!role) {
            setBusyRole(null)
            return
          }

          if (response?.error || !response?.access_token) {
            setRoleStatus(role, 'Autenticazione Google annullata o non riuscita.', 'error')
            setBusyRole(null)
            return
          }

          await submitGoogleRegistration(role, '', response.access_token)
        },
      })
    }

    return googleIdInitializedRef.current || Boolean(googleTokenClientRef.current)
  }

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

  async function postRegistration(
    endpoint: string,
    role: 'pet_owner' | 'pet_assistant',
    body: Record<string, unknown>,
    mode: 'email' | 'social' = 'email'
  ) {
    setBusyRole(role)
    setRoleStatus(role, '', 'error')

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          role,
          ...body,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Registrazione non completata.')
      }

      persistCurrentUser(payload?.data?.user ?? null)

      if (mode === 'social') {
        const fallbackRedirect = role === 'pet_owner'
          ? '/profile/petowner?entry=register'
          : '/profile/petassistant?entry=register'
        window.location.assign(sanitizeText(payload?.data?.redirect ?? '') || fallbackRedirect)
        return
      }

      setRoleStatus(role, 'Registrazione completata. Controlla la tua email per confermare.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante la registrazione.'
      if (message === 'Email gia registrata.') {
        setRoleStatus(role, '', 'error')
        showToast(message, 'error')
      } else if (TECHNICAL_AUTH_MESSAGES.has(message)) {
        await handleGenericAuthTechnicalError(role, 'RegisterPage.postRegistration', message, { endpoint })
      } else {
        setRoleStatus(role, message, 'error')
      }
    } finally {
      setBusyRole(null)
    }
  }

  async function submitEmailRegistration(
    role: 'pet_owner' | 'pet_assistant',
    email: string,
    password: string
  ) {
    const normalizedEmail = sanitizeText(email)
    if (!validateEmail(normalizedEmail)) {
      setRoleStatus(role, 'Indirizzo email errato.', 'error')
      return
    }

    const passwordValidationMessage = getPasswordValidationMessage(password)
    if (passwordValidationMessage) {
      setRoleStatus(role, '', 'error')
      showToast('La password inserita non rispetta i criteri previsti.', 'error')
      return
    }

    await postRegistration('/api/auth/register/email', role, {
      email: normalizedEmail,
      password,
    }, 'email')
  }

  async function submitGoogleRegistration(
    role: 'pet_owner' | 'pet_assistant',
    idToken: string,
    accessToken: string = ''
  ) {
    await postRegistration('/api/auth/register/google', role, {
      idToken,
      accessToken,
    }, 'social')
  }

  async function submitAppleRegistration(
    role: 'pet_owner' | 'pet_assistant',
    identityToken: string,
    user: unknown
  ) {
    await postRegistration('/api/auth/register/apple', role, {
      identityToken,
      user,
    }, 'social')
  }

  async function submitAppleMockRegistration(role: 'pet_owner' | 'pet_assistant') {
    const now = Date.now()
    const mockEmail = `applemock+${role}+${now}@privaterelay.appleid.com`
    const mockName = role === 'pet_owner' ? 'Apple Mock Pet Owner' : 'Apple Mock Pet Assistant'

    await postRegistration('/api/auth/register/apple/mock', role, {
      mockEmail,
      mockName,
      mockSub: `apple_mock_${role}_${now}`,
    }, 'social')
  }

  async function handleGoogleRegistration(role: 'pet_owner' | 'pet_assistant') {
    if (!authConfig.googleClientId) {
      await handleGenericAuthTechnicalError(
        role,
        'RegisterPage.handleGoogleRegistration',
        'GOOGLE_CLIENT_ID non configurato nel backend.'
      )
      return
    }

    if (!window.google?.accounts) {
      await handleGenericAuthTechnicalError(
        role,
        'RegisterPage.handleGoogleRegistration',
        'SDK Google non disponibile.'
      )
      return
    }

    pendingGoogleRoleRef.current = role
    setBusyRole(role)
    setRoleStatus(role, '', 'error')

    ensureGoogleClientsInitialized()

    if (googleTokenClientRef.current) {
      googleTokenClientRef.current.requestAccessToken({ prompt: 'select_account' })
      return
    }

    if (!window.google.accounts.id) {
      await handleGenericAuthTechnicalError(
        role,
        'RegisterPage.handleGoogleRegistration',
        'SDK Google non disponibile.'
      )
      setBusyRole(null)
      return
    }

    window.google.accounts.id.prompt((notification) => {
      if (notification?.isNotDisplayed?.()) {
        setBusyRole(null)
        void handleGenericAuthTechnicalError(
          role,
          'RegisterPage.handleGoogleRegistration',
          'Google non disponibile su questo browser. Riprova o usa Email.'
        )
      }
    })
  }

  async function handleAppleRegistration(role: 'pet_owner' | 'pet_assistant') {
    if (authConfig.appleMockAuth) {
      await submitAppleMockRegistration(role)
      return
    }

    if (!authConfig.appleClientId || !authConfig.appleRedirectUri) {
      await handleGenericAuthTechnicalError(
        role,
        'RegisterPage.handleAppleRegistration',
        'Config Apple non completa (clientId / redirectURI).'
      )
      return
    }

    if (!window.AppleID?.auth) {
      await handleGenericAuthTechnicalError(
        role,
        'RegisterPage.handleAppleRegistration',
        'SDK Apple non disponibile.'
      )
      return
    }

    setBusyRole(role)
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

      await submitAppleRegistration(role, identityToken, response?.user ?? null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore autenticazione Apple.'
      if (message === 'Token Apple non disponibile.') {
        await handleGenericAuthTechnicalError(
          role,
          'RegisterPage.handleAppleRegistration',
          message
        )
      } else {
        setRoleStatus(role, message, 'error')
      }
      setBusyRole(null)
    }
  }

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
            role="pet_owner"
            title="Registrazione Pet Owner"
            subtitle="Trova il supporto perfetto per il tuo pet con un profilo in pochi passaggi."
            buttonClassName="is-owner"
            isBusy={busyRole === 'pet_owner'}
            onSubmitEmail={submitEmailRegistration}
            onClickGoogle={handleGoogleRegistration}
            onClickApple={handleAppleRegistration}
          />
          <RoleCard
            role="pet_assistant"
            title="Registrazione Pet Assistant"
            subtitle="Entra nel network professionale e inizia a ricevere richieste qualificate."
            buttonClassName="is-assistant"
            isBusy={busyRole === 'pet_assistant'}
            onSubmitEmail={submitEmailRegistration}
            onClickGoogle={handleGoogleRegistration}
            onClickApple={handleAppleRegistration}
          />
        </section>
      </section>

      {toastMessage ? (
        <div className={`register-toast ${toastType === 'error' ? 'is-error' : 'is-success'}`}>
          {toastMessage}
        </div>
      ) : null}
    </main>
  )
}
