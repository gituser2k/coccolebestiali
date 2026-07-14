import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { sanitizeText, validateEmail } from '../utility.js'

type PortalRole = 'pet_owner' | 'pet_assistant'

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

type AccountChangeModalProps = {
  role: PortalRole
  onClose: () => void
  onChanged: (user: Record<string, unknown>, message: string) => void
  onError: (message: string) => void
}

type SocialAccountSwitchActionsProps = {
  role: PortalRole
  onChanged: (user: Record<string, unknown>, message: string) => void
  onError: (message: string) => void
  buttonPrefix?: string
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
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.47a5.54 5.54 0 0 1-2.4 3.64v3h3.88c2.27-2.1 3.54-5.2 3.54-8.67z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.93l-3.88-3c-1.08.73-2.46 1.16-4.07 1.16-3.13 0-5.78-2.12-6.73-4.97H1.26v3.09A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.26A7.2 7.2 0 0 1 4.9 12c0-.79.13-1.55.37-2.26V6.64H1.26A12 12 0 0 0 0 12c0 1.93.46 3.76 1.26 5.36l4.01-3.1z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.8l3.43-3.43C17.96 1.25 15.24 0 12 0A12 12 0 0 0 1.26 6.64l4.01 3.1C6.22 6.89 8.87 4.77 12 4.77z" />
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
  return Object.values(checks).every(Boolean) ? '' : 'La password inserita non rispetta i criteri previsti.'
}

export function SocialAccountSwitchActions({
  role,
  onChanged,
  onError,
  buttonPrefix = 'Cambia con',
}: SocialAccountSwitchActionsProps) {
  const [authConfig, setAuthConfig] = useState<PublicAuthConfig>({
    googleClientId: '',
    appleClientId: '',
    appleRedirectUri: '',
    appleMockAuth: false,
  })
  const [isBusy, setIsBusy] = useState(false)
  const googleTokenClientRef = useRef<{ requestAccessToken: (params?: { prompt?: string }) => void } | null>(null)
  const googleIdInitializedRef = useRef(false)
  const roleTitle = role === 'pet_assistant' ? 'Pet Assistant' : 'Pet Owner'
  const appleButtonLabel = buttonPrefix === 'Passa a' ? 'Passa ad Apple' : `${buttonPrefix} Apple`

  useEffect(() => {
    async function loadAuthConfig() {
      try {
        const response = await fetch('/api/auth/config', {
          headers: {
            Accept: 'application/json',
          },
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || !payload?.ok) {
          throw new Error('Configurazione autenticazione non disponibile.')
        }

        setAuthConfig({
          googleClientId: sanitizeText(payload?.data?.googleClientId ?? ''),
          appleClientId: sanitizeText(payload?.data?.appleClientId ?? ''),
          appleRedirectUri: sanitizeText(payload?.data?.appleRedirectUri ?? ''),
          appleMockAuth: Boolean(payload?.data?.appleMockAuth),
        })
      } catch {
        onError('Si è verificato un errore. Riprova più tardi.')
      }
    }

    void loadAuthConfig()
  }, [onError])

  function ensureGoogleClientsInitialized() {
    if (!authConfig.googleClientId || !window.google?.accounts) {
      return false
    }

    if (!googleIdInitializedRef.current && window.google.accounts.id) {
      window.google.accounts.id.initialize({
        client_id: authConfig.googleClientId,
        callback: async (response) => {
          if (!response?.credential) {
            setIsBusy(false)
            return
          }
          await submitGoogleAccountChange(response.credential)
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
            setIsBusy(false)
            onError('Autenticazione Google annullata o non riuscita.')
            return
          }

          await submitGoogleAccountChange('', response.access_token)
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
  }, [authConfig.googleClientId])

  async function postSocialAccountChange(endpoint: string, body: Record<string, unknown>) {
    setIsBusy(true)

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
        throw new Error(payload?.message || 'Cambio account non completato.')
      }

      onChanged(payload?.data?.user ?? {}, payload?.message || 'Account aggiornato con successo.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cambio account non completato.'
      onError(message)
    } finally {
      setIsBusy(false)
    }
  }

  async function submitGoogleAccountChange(idToken: string, accessToken: string = '') {
    await postSocialAccountChange('/api/auth/account/google', {
      idToken,
      accessToken,
    })
  }

  async function handleGoogleAccountChange() {
    if (!authConfig.googleClientId || !window.google?.accounts) {
      onError('Si è verificato un errore. Riprova più tardi.')
      return
    }

    setIsBusy(true)
    ensureGoogleClientsInitialized()

    if (googleTokenClientRef.current) {
      googleTokenClientRef.current.requestAccessToken({ prompt: 'select_account' })
      return
    }

    if (!window.google.accounts.id) {
      setIsBusy(false)
      onError('Si è verificato un errore. Riprova più tardi.')
      return
    }

    window.google.accounts.id.prompt((notification) => {
      if (notification?.isNotDisplayed?.()) {
        setIsBusy(false)
        onError('Si è verificato un errore. Riprova più tardi.')
      }
    })
  }

  async function handleAppleAccountChange() {
    if (authConfig.appleMockAuth) {
      const now = Date.now()
      await postSocialAccountChange('/api/auth/account/apple/mock', {
        mockEmail: `applemock-change+${role}+${now}@privaterelay.appleid.com`,
        mockName: `Apple Mock ${roleTitle}`,
        mockSub: `apple_mock_change_${role}_${now}`,
      })
      return
    }

    if (!authConfig.appleClientId || !authConfig.appleRedirectUri || !window.AppleID?.auth) {
      onError('Si è verificato un errore. Riprova più tardi.')
      return
    }

    setIsBusy(true)
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

      await postSocialAccountChange('/api/auth/account/apple', {
        identityToken,
        user: response?.user ?? null,
      })
    } catch {
      onError('Cambio account Apple non completato.')
      setIsBusy(false)
    }
  }

  return (
    <div className="social-actions">
      <button className="social-btn" type="button" disabled={isBusy} onClick={() => void handleGoogleAccountChange()}>
        <GoogleIcon />
        {buttonPrefix} Google
      </button>
      <button className="social-btn" type="button" disabled={isBusy} onClick={() => void handleAppleAccountChange()}>
        <AppleIcon />
        {appleButtonLabel}
      </button>
    </div>
  )
}

export default function AccountChangeModal({
  role,
  onClose,
  onChanged,
  onError,
}: AccountChangeModalProps) {
  const [authConfig, setAuthConfig] = useState<PublicAuthConfig>({
    googleClientId: '',
    appleClientId: '',
    appleRedirectUri: '',
    appleMockAuth: false,
  })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const googleTokenClientRef = useRef<{ requestAccessToken: (params?: { prompt?: string }) => void } | null>(null)
  const googleIdInitializedRef = useRef(false)

  const passwordChecks = getPasswordChecks(password)
  const hasPasswordInput = password.length > 0
  const roleTitle = role === 'pet_assistant' ? 'Pet Assistant' : 'Pet Owner'

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    async function loadAuthConfig() {
      try {
        const response = await fetch('/api/auth/config', {
          headers: {
            Accept: 'application/json',
          },
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || !payload?.ok) {
          throw new Error('Configurazione autenticazione non disponibile.')
        }

        setAuthConfig({
          googleClientId: sanitizeText(payload?.data?.googleClientId ?? ''),
          appleClientId: sanitizeText(payload?.data?.appleClientId ?? ''),
          appleRedirectUri: sanitizeText(payload?.data?.appleRedirectUri ?? ''),
          appleMockAuth: Boolean(payload?.data?.appleMockAuth),
        })
      } catch {
        onError('Si è verificato un errore. Riprova più tardi.')
      }
    }

    void loadAuthConfig()
  }, [onError])

  function ensureGoogleClientsInitialized() {
    if (!authConfig.googleClientId || !window.google?.accounts) {
      return false
    }

    if (!googleIdInitializedRef.current && window.google.accounts.id) {
      window.google.accounts.id.initialize({
        client_id: authConfig.googleClientId,
        callback: async (response) => {
          if (!response?.credential) {
            setIsBusy(false)
            return
          }
          await submitGoogleAccountChange(response.credential)
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
            setIsBusy(false)
            onError('Autenticazione Google annullata o non riuscita.')
            return
          }

          await submitGoogleAccountChange('', response.access_token)
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
  }, [authConfig.googleClientId])

  async function postAccountChange(endpoint: string, body: Record<string, unknown>) {
    setIsBusy(true)

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
        throw new Error(payload?.message || 'Cambio account non completato.')
      }

      onChanged(payload?.data?.user ?? {}, payload?.message || 'Account aggiornato con successo.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cambio account non completato.'
      onError(message)
    } finally {
      setIsBusy(false)
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedEmail = sanitizeText(email)
    if (!validateEmail(normalizedEmail)) {
      onError('Indirizzo email errato.')
      return
    }

    const passwordValidationMessage = getPasswordValidationMessage(password)
    if (passwordValidationMessage) {
      onError(passwordValidationMessage)
      return
    }

    await postAccountChange('/api/auth/account/email', {
      email: normalizedEmail,
      password,
    })
  }

  async function submitGoogleAccountChange(idToken: string, accessToken: string = '') {
    await postAccountChange('/api/auth/account/google', {
      idToken,
      accessToken,
    })
  }

  async function handleGoogleAccountChange() {
    if (!authConfig.googleClientId || !window.google?.accounts) {
      onError('Si è verificato un errore. Riprova più tardi.')
      return
    }

    setIsBusy(true)
    ensureGoogleClientsInitialized()

    if (googleTokenClientRef.current) {
      googleTokenClientRef.current.requestAccessToken({ prompt: 'select_account' })
      return
    }

    if (!window.google.accounts.id) {
      setIsBusy(false)
      onError('Si è verificato un errore. Riprova più tardi.')
      return
    }

    window.google.accounts.id.prompt((notification) => {
      if (notification?.isNotDisplayed?.()) {
        setIsBusy(false)
        onError('Si è verificato un errore. Riprova più tardi.')
      }
    })
  }

  async function handleAppleAccountChange() {
    if (authConfig.appleMockAuth) {
      const now = Date.now()
      await postAccountChange('/api/auth/account/apple/mock', {
        mockEmail: `applemock-change+${role}+${now}@privaterelay.appleid.com`,
        mockName: `Apple Mock ${roleTitle}`,
        mockSub: `apple_mock_change_${role}_${now}`,
      })
      return
    }

    if (!authConfig.appleClientId || !authConfig.appleRedirectUri || !window.AppleID?.auth) {
      onError('Si è verificato un errore. Riprova più tardi.')
      return
    }

    setIsBusy(true)
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

      await postAccountChange('/api/auth/account/apple', {
        identityToken,
        user: response?.user ?? null,
      })
    } catch {
      onError('Cambio account Apple non completato.')
      setIsBusy(false)
    }
  }

  return (
    <div className="profile-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="change-account-title">
      <div className="profile-password-modal account-change-modal">
        <div className="profile-modal-head">
          <div>
            <p className="profile-location-kicker">ACCESSO ACCOUNT</p>
            <h2 id="change-account-title" className="profile-modal-title">Cambia Account {roleTitle}</h2>
          </div>
          <button type="button" className="profile-modal-close" aria-label="Chiudi modale cambio account" onClick={onClose}>
            ×
          </button>
        </div>

        <article className="register-card account-change-card">
          <h3 className="register-card-title">Nuovo metodo di accesso</h3>
          <p className="register-card-subtitle">
            Sostituisci Google, Apple oppure passa a Email e Password.
          </p>

          <form className="register-form" onSubmit={handleEmailSubmit}>
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

            <button className={`register-action ${role === 'pet_owner' ? 'is-owner' : 'is-assistant'}`} type="submit" disabled={isBusy}>
              Cambia con Email
            </button>
          </form>

          <div className="register-divider" aria-hidden="true">
            <span>oppure</span>
          </div>

          <div className="social-actions">
            <button className="social-btn" type="button" disabled={isBusy} onClick={() => void handleGoogleAccountChange()}>
              <GoogleIcon />
              Cambia con Google
            </button>
            <button className="social-btn" type="button" disabled={isBusy} onClick={() => void handleAppleAccountChange()}>
              <AppleIcon />
              Cambia con Apple
            </button>
          </div>
        </article>
      </div>
    </div>
  )
}
