import PublicFooter from '../components/PublicFooter'
import HomeActiveBookings from '../components/HomeActiveBookings'
import '../css/home.css'
import animaliImage from '../assets/animali.png'
import logoImage from '../assets/logo.png'
import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { csrfFetch as fetch } from '../auth/csrf'
import { getAppleAuthChallenge } from '../auth/appleOAuth'
import { areRequiredFieldsFilled, sanitizeText, validateEmail } from '../utility.js'
import {
  fetchAuthRequest,
  getGoogleAccounts,
  getGooglePopupMessage,
  initializeGoogleIdentity,
  initializeGoogleTokenClient,
  loadGoogleIdentitySdk,
  promptGoogleIdentity,
} from '../auth/googleOAuth'
import type { GooglePopupError, GoogleTokenClient } from '../auth/googleOAuth'

function publicProfileReturnPath(): string {
  const path = new URLSearchParams(window.location.search).get('returnTo') ?? ''
  return /^\/pet-assistants\/[1-9]\d*(?:\?[^\r\n]*)?$/.test(path) ? path : ''
}

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
  name: string
  email: string
  passwordResetRequired?: boolean
  capabilities: Array<{ capability: 'owner' | 'assistant'; status: string; currentStep: string }>
  activeCapabilities: Array<'owner' | 'assistant'>
  modes: {
    available: Array<'owner' | 'assistant'>
    default: 'owner' | 'assistant' | ''
    current?: 'owner' | 'assistant' | ''
  }
}

type PasswordChecks = {
  minLength: boolean
  uppercase: boolean
  lowercase: boolean
  number: boolean
  symbol: boolean
  noSpaces: boolean
}

type AuthView = 'default' | 'login' | 'register'
type RegistrationStatus = { type: 'error' | 'success'; message: string } | null

function getAuthViewFromLocation(): AuthView {
  const params = new URLSearchParams(window.location.search)
  const requestedView = params.get('auth')

  if (requestedView === 'login' || requestedView === 'register') {
    return requestedView
  }

  return params.get('login') === '1' && Boolean(publicProfileReturnPath()) ? 'login' : 'default'
}

declare global {
  interface Window {
    AppleID?: {
      auth?: {
        init: (params: {
          clientId: string
          scope: string
          redirectURI: string
          usePopup: boolean
          nonce: string
          state: string
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
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9\s]/.test(password),
    noSpaces: !/\s/.test(password),
  }
}

function isPasswordValid(password: string): boolean {
  return Object.values(getPasswordChecks(password)).every(Boolean)
}

function HomePage() {
  const [authConfig, setAuthConfig] = useState<PublicAuthConfig>({
    googleClientId: '',
    appleClientId: '',
    appleRedirectUri: '',
    appleMockAuth: false,
  })
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false)
  const [authView, setAuthView] = useState<AuthView>(getAuthViewFromLocation)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoginBusy, setIsLoginBusy] = useState(false)
  const [isCredentialLoginBusy, setIsCredentialLoginBusy] = useState(false)
  const [isRegistrationBusy, setIsRegistrationBusy] = useState(false)
  const [isLogoutBusy, setIsLogoutBusy] = useState(false)
  const [isModeBusy, setIsModeBusy] = useState(false)
  const [isAssistantOnboardingBusy, setIsAssistantOnboardingBusy] = useState(false)
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false)
  const [isForgotPasswordBusy, setIsForgotPasswordBusy] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [isTemporaryPasswordModalOpen, setIsTemporaryPasswordModalOpen] = useState(false)
  const [isTemporaryPasswordSaving, setIsTemporaryPasswordSaving] = useState(false)
  const [temporaryNewPassword, setTemporaryNewPassword] = useState('')
  const [temporaryConfirmPassword, setTemporaryConfirmPassword] = useState('')
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
  const [registrationData, setRegistrationData] = useState({
    email: '',
    password: '',
    passwordConfirmation: '',
  })
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>(null)
  const googleTokenClientRef = useRef<GoogleTokenClient | null>(null)
  const googleIdInitializedRef = useRef(false)
  const googleAuthIntentRef = useRef<'login' | 'register'>('login')
  const loginTriggerRef = useRef<HTMLButtonElement | null>(null)
  const registerTriggerRef = useRef<HTMLButtonElement | null>(null)
  const lastAuthTriggerRef = useRef<HTMLButtonElement | null>(null)
  const temporaryPasswordChecks = getPasswordChecks(temporaryNewPassword)
  const registrationPasswordChecks = getPasswordChecks(registrationData.password)
  const hasRegistrationPasswordInput = registrationData.password.length > 0
  const isRegistrationConfirmationValid =
    registrationData.passwordConfirmation.length > 0 &&
    registrationData.passwordConfirmation === registrationData.password
  const hasTemporaryPasswordInput = temporaryNewPassword.length > 0
  const isTemporaryPasswordConfirmationValid =
    temporaryConfirmPassword.length > 0 && temporaryConfirmPassword === temporaryNewPassword

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
    // Initial auth bootstrap must run once on page load; the functions use current module state intentionally.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handlePopState = () => {
      setAuthView(getAuthViewFromLocation())
      setLoginData((current) => ({ ...current, password: '' }))
      setRegistrationData((current) => ({ ...current, password: '', passwordConfirmation: '' }))
      setRegistrationStatus(null)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!currentUser || authView === 'default') {
      return
    }

    setAuthView('default')
    updateAuthUrl('default', 'replace')
    // Authentication views are not available while a portal session is active.
  }, [currentUser, authView])

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
    // Google SDK bootstrap is driven only by the public client id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authConfig.googleClientId])

  function showToast(message: string, type: 'error' | 'success') {
    setToastMessage(message)
    setToastType(type)
  }

  function updateAuthUrl(view: AuthView, method: 'push' | 'replace' = 'push') {
    const url = new URL(window.location.href)
    url.searchParams.delete('login')

    if (view === 'default') {
      url.searchParams.delete('auth')
      url.searchParams.delete('verified')
    } else {
      url.searchParams.set('auth', view)
    }

    window.history[method === 'push' ? 'pushState' : 'replaceState']({}, '', `${url.pathname}${url.search}${url.hash}`)
  }

  function openAuthView(view: Exclude<AuthView, 'default'>, trigger: HTMLButtonElement | null) {
    lastAuthTriggerRef.current = trigger
    setLoginData((current) => ({ ...current, password: '' }))
    setRegistrationData((current) => ({ ...current, password: '', passwordConfirmation: '' }))
    setRegistrationStatus(null)
    setAuthView(view)
    updateAuthUrl(view)
  }

  function closeAuthView() {
    setLoginData((current) => ({ ...current, password: '' }))
    setRegistrationData((current) => ({ ...current, password: '', passwordConfirmation: '' }))
    setRegistrationStatus(null)
    setAuthView('default')
    updateAuthUrl('default')

    window.requestAnimationFrame(() => lastAuthTriggerRef.current?.focus())
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
    showToast(GENERIC_AUTH_ERROR_MESSAGE, 'error')
    await reportTechnicalAuthError(context, message, details)
  }

  function normalizePortalUser(user: unknown): PortalUser | null {
    if (!user || typeof user !== 'object') {
      return null
    }

    const candidate = user as Record<string, unknown>
    const id = Number(candidate.id ?? 0)
    const name = sanitizeText(candidate.name ?? '')
    const email = sanitizeText(candidate.email ?? '')
    const passwordResetRequired = Boolean(candidate.passwordResetRequired)
    const capabilities = Array.isArray(candidate.capabilities)
      ? candidate.capabilities.map((item) => {
          const capability = item && typeof item === 'object' ? item as Record<string, unknown> : {}
          return {
            capability: sanitizeText(capability.capability) === 'assistant' ? 'assistant' as const : 'owner' as const,
            status: sanitizeText(capability.status),
            currentStep: sanitizeText(capability.currentStep),
          }
        })
      : []
    const activeCapabilities = Array.isArray(candidate.activeCapabilities)
      ? candidate.activeCapabilities.filter((item): item is 'owner' | 'assistant' => item === 'owner' || item === 'assistant')
      : []
    const rawModes = candidate.modes && typeof candidate.modes === 'object' ? candidate.modes as Record<string, unknown> : {}
    const availableModes = Array.isArray(rawModes.available)
      ? rawModes.available.filter((item): item is 'owner' | 'assistant' => item === 'owner' || item === 'assistant')
      : activeCapabilities
    const defaultMode = rawModes.default === 'assistant' ? 'assistant' : rawModes.default === 'owner' ? 'owner' : ''
    const currentMode = rawModes.current === 'assistant' ? 'assistant' : rawModes.current === 'owner' ? 'owner' : ''

    if (id <= 0) {
      return null
    }

    return {
      id,
      name,
      email,
      passwordResetRequired,
      capabilities,
      activeCapabilities,
      modes: { available: availableModes, default: defaultMode, current: currentMode },
    }
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
    if (!authConfig.googleClientId || !getGoogleAccounts()) {
      return false
    }

    if (!googleIdInitializedRef.current) {
      googleIdInitializedRef.current = initializeGoogleIdentity(
        authConfig.googleClientId,
        async (response) => {
          if (!response?.credential) {
            setIsLoginBusy(false)
            setIsRegistrationBusy(false)
            return
          }

          if (googleAuthIntentRef.current === 'register') {
            await submitGoogleRegistration(response.credential)
          } else {
            await submitGoogleLogin(response.credential)
          }
        }
      )
    }

    if (!googleTokenClientRef.current) {
      googleTokenClientRef.current = initializeGoogleTokenClient(
        authConfig.googleClientId,
        async (response) => {
          if (response?.error || !response?.access_token) {
            showToast('Autenticazione Google annullata o non riuscita.', 'error')
            setIsLoginBusy(false)
            setIsRegistrationBusy(false)
            return
          }

          if (googleAuthIntentRef.current === 'register') {
            await submitGoogleRegistration('', response.access_token)
          } else {
            await submitGoogleLogin('', response.access_token)
          }
        },
        handleGooglePopupError
      )
    }

    return googleIdInitializedRef.current || Boolean(googleTokenClientRef.current)
  }

  function handleGooglePopupError(error: GooglePopupError) {
    setIsLoginBusy(false)
    setIsRegistrationBusy(false)
    const message = getGooglePopupMessage(error)
    showToast(message, error.type === 'popup_closed' ? 'success' : 'error')

    if (!['popup_closed', 'popup_failed_to_open'].includes(error.type ?? '')) {
      void reportTechnicalAuthError('HomePage.handleGooglePopupError', message, {
        type: error.type ?? 'unknown',
      })
    }
  }

  async function postLogin(endpoint: string, body: Record<string, unknown>) {
    setIsLoginBusy(true)

    try {
      const response = await fetchAuthRequest(endpoint, {
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

      const user = normalizePortalUser(payload?.data?.user ?? null)
      persistCurrentUser(payload?.data?.user ?? null)
      setAuthView('default')
      updateAuthUrl('default', 'replace')

      if (endpoint === '/api/auth/login/email' && user?.passwordResetRequired) {
        setTemporaryNewPassword('')
        setTemporaryConfirmPassword('')
        setIsTemporaryPasswordModalOpen(true)
        showToast('Imposta una nuova password per completare l accesso.', 'success')
        return
      }

      setLoginData({ email: '', password: '' })
      const returnPath = publicProfileReturnPath()
      if (returnPath) window.location.assign(returnPath)
      else showToast('Login completato.', 'success')
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'Login non completato. Riprova.'
        : error instanceof Error ? error.message : 'Errore durante il login.'
      if (TECHNICAL_AUTH_MESSAGES.has(message)) {
        await handleGenericAuthTechnicalError('HomePage.postLogin', message, { endpoint })
      } else {
        showToast(message, 'error')
      }
    } finally {
      setIsLoginBusy(false)
    }
  }

  async function handleForgotPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const email = sanitizeText(forgotPasswordEmail)
    if (!validateEmail(email)) {
      showToast('Indirizzo email errato.', 'error')
      return
    }

    try {
      setIsForgotPasswordBusy(true)

      const response = await fetch('/api/auth/password/forgot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Richiesta non completata.')
      }

      setIsForgotPasswordModalOpen(false)
      setForgotPasswordEmail('')
      setLoginData((current) => ({ ...current, email }))
      showToast(payload?.message || 'Password temporanea inviata', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Si è verificato un errore. Riprova più tardi.'
      showToast(message, 'error')
    } finally {
      setIsForgotPasswordBusy(false)
    }
  }

  async function handleTemporaryPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isPasswordValid(temporaryNewPassword)) {
      showToast('La password inserita non rispetta i criteri previsti.', 'error')
      return
    }

    if (temporaryNewPassword !== temporaryConfirmPassword) {
      showToast('Le password inserite non coincidono.', 'error')
      return
    }

    try {
      setIsTemporaryPasswordSaving(true)

      const response = await fetch('/api/auth/password/temporary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          password: temporaryNewPassword,
          password_confirmation: temporaryConfirmPassword,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Cambio password non completato.')
      }

      persistCurrentUser(payload?.data?.user ?? null)
      setIsTemporaryPasswordModalOpen(false)
      setTemporaryNewPassword('')
      setTemporaryConfirmPassword('')
      const returnPath = publicProfileReturnPath()
      if (returnPath) window.location.assign(returnPath)
      else showToast('Password aggiornata. Accesso completato.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cambio password non completato.'
      showToast(message, 'error')
    } finally {
      setIsTemporaryPasswordSaving(false)
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
      setAuthView('default')
      updateAuthUrl('default', 'replace')
      showToast('Logout completato.', 'success')
    } catch {
      showToast('Si è verificato un errore. Riprova più tardi.', 'error')
    } finally {
      setIsLogoutBusy(false)
    }
  }

  async function switchPortalMode(mode: 'owner' | 'assistant') {
    if (!currentUser || currentUser.modes.current === mode || isModeBusy) return

    try {
      setIsModeBusy(true)
      const response = await fetch('/api/auth/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || 'Cambio modalità non completato.')
      persistCurrentUser(payload?.data?.user ?? null)
      showToast(`Modalità ${mode === 'assistant' ? 'Pet Assistant' : 'Pet Owner'} attiva.`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Cambio modalità non completato.', 'error')
    } finally {
      setIsModeBusy(false)
    }
  }

  async function startAssistantOnboarding() {
    if (!currentUser || isAssistantOnboardingBusy) return

    try {
      setIsAssistantOnboardingBusy(true)
      const response = await fetch('/api/profile/petassistant/onboarding/start', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || 'Avvio del profilo non completato.')
      window.location.assign('/profile/petassistant?onboarding=1&section=personal')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Avvio del profilo non completato.', 'error')
      setIsAssistantOnboardingBusy(false)
    }
  }

  const currentUserInitial = (() => {
    const source = sanitizeText(currentUser?.name || currentUser?.email || '')
    return source ? source.charAt(0).toUpperCase() : ''
  })()

  const currentMode = currentUser?.modes.current || currentUser?.modes.default || 'owner'
  const currentUserProfilePath = currentMode === 'assistant'
    ? '/profile/petassistant?entry=login'
    : '/profile/petowner?entry=login'
  const hasActiveAssistant = Boolean(currentUser?.activeCapabilities.includes('assistant'))
  const assistantCapability = currentUser?.capabilities.find((item) => item.capability === 'assistant')
  const hasAssistantDraft = Boolean(assistantCapability && ['draft', 'pending_verification'].includes(assistantCapability.status))
  const isAssistantUnavailable = Boolean(assistantCapability && ['suspended', 'rejected', 'disabled'].includes(assistantCapability.status))
  const showAssistantOnboardingCta = Boolean(currentUser && !hasActiveAssistant && !isAssistantUnavailable)

  async function handleCredentialLogin() {
    const email = sanitizeText(loginData.email)
    const password = loginData.password

    if (!validateEmail(email)) {
      showToast('Indirizzo email errato.', 'error')
      return
    }

    if (!sanitizeText(password)) {
      showToast('Inserisci la password.', 'error')
      return
    }

    setIsCredentialLoginBusy(true)
    try {
      await postLogin('/api/auth/login/email', {
        email,
        password,
      })
    } finally {
      setIsCredentialLoginBusy(false)
    }
  }

  async function submitGoogleLogin(idToken: string, accessToken: string = '') {
    await postLogin('/api/auth/login/google', {
      idToken,
      accessToken,
    })
  }

  async function submitAppleLogin(identityToken: string, user: unknown, state: string) {
    await postLogin('/api/auth/login/apple', {
      identityToken,
      user,
      state,
    })
  }

  async function submitAppleMockLogin() {
    const mockEmail = sanitizeText(loginData.email).toLowerCase()

    if (!validateEmail(mockEmail)) {
      showToast('Per Apple in locale inserisci prima l email registrata.', 'error')
      return
    }

    await postLogin('/api/auth/login/apple/mock', {
      mockEmail,
    })
  }

  async function handleGoogleLogin() {
    googleAuthIntentRef.current = 'login'

    if (!authConfig.googleClientId) {
      await handleGenericAuthTechnicalError(
        'HomePage.handleGoogleLogin',
        'GOOGLE_CLIENT_ID non configurato nel backend.'
      )
      return
    }

    if (!await loadGoogleIdentitySdk()) {
      await handleGenericAuthTechnicalError('HomePage.handleGoogleLogin', 'SDK Google non disponibile.')
      return
    }

    setIsLoginBusy(true)

    ensureGoogleClientsInitialized()

    if (googleTokenClientRef.current) {
      try {
        googleTokenClientRef.current.requestAccessToken({ prompt: 'select_account' })
      } catch {
        handleGooglePopupError({ type: 'unknown' })
      }
      return
    }

    if (!getGoogleAccounts()?.id) {
      await handleGenericAuthTechnicalError('HomePage.handleGoogleLogin', 'SDK Google non disponibile.')
      setIsLoginBusy(false)
      return
    }

    const prompted = promptGoogleIdentity((notification) => {
      if (notification?.isNotDisplayed?.()) {
        setIsLoginBusy(false)
        void handleGenericAuthTechnicalError(
          'HomePage.handleGoogleLogin',
          'Google non disponibile su questo browser. Riprova o usa Email.'
        )
      }
    })

    if (!prompted) {
      setIsLoginBusy(false)
    }
  }

  async function handleAppleLogin() {
    if (authConfig.appleMockAuth) {
      await submitAppleMockLogin()
      return
    }

    if (!authConfig.appleClientId || !authConfig.appleRedirectUri) {
      showToast('Metodo di Login ancora non disponibile', 'success')
      return
    }

    if (!window.AppleID?.auth) {
      await handleGenericAuthTechnicalError('HomePage.handleAppleLogin', 'SDK Apple non disponibile.')
      return
    }

    setIsLoginBusy(true)

    try {
      const challenge = await getAppleAuthChallenge()
      window.AppleID.auth.init({
        clientId: authConfig.appleClientId,
        scope: 'name email',
        redirectURI: authConfig.appleRedirectUri,
        usePopup: true,
        nonce: challenge.nonce,
        state: challenge.state,
      })

      const response = await window.AppleID.auth.signIn()
      const identityToken = response?.authorization?.id_token ?? ''

      if (!identityToken) {
        throw new Error('Token Apple non disponibile.')
      }

      await submitAppleLogin(identityToken, response?.user ?? null, challenge.state)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore autenticazione Apple.'
      if (message === 'Token Apple non disponibile.') {
        await handleGenericAuthTechnicalError('HomePage.handleAppleLogin', message)
      } else {
        showToast(message, 'error')
      }
      setIsLoginBusy(false)
    }
  }

  async function postRegistration(
    endpoint: string,
    body: Record<string, unknown>,
    mode: 'email' | 'social'
  ) {
    setIsRegistrationBusy(true)
    setRegistrationStatus(null)

    try {
      const response = await fetchAuthRequest(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Registrazione non completata.')
      }

      setRegistrationData((current) => ({ ...current, password: '', passwordConfirmation: '' }))

      if (mode === 'social') {
        persistCurrentUser(payload?.data?.user ?? null)
        window.location.assign(sanitizeText(payload?.data?.redirect ?? '') || '/')
        return
      }

      setRegistrationStatus({
        type: 'success',
        message: 'Registrazione completata. Controlla la tua email per confermare l account.',
      })
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'Registrazione non completata. Riprova.'
        : error instanceof Error ? error.message : 'Errore durante la registrazione.'

      if (TECHNICAL_AUTH_MESSAGES.has(message)) {
        await handleGenericAuthTechnicalError('HomePage.postRegistration', message, { endpoint })
      } else {
        setRegistrationStatus({ type: 'error', message })
      }
    } finally {
      setIsRegistrationBusy(false)
    }
  }

  async function handleEmailRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const email = sanitizeText(registrationData.email).toLowerCase()
    if (!validateEmail(email)) {
      setRegistrationStatus({ type: 'error', message: 'Indirizzo email errato.' })
      return
    }

    if (!isPasswordValid(registrationData.password)) {
      setRegistrationStatus({
        type: 'error',
        message: 'La password inserita non rispetta i criteri previsti.',
      })
      return
    }

    if (!isRegistrationConfirmationValid) {
      setRegistrationStatus({ type: 'error', message: 'Le password inserite non coincidono.' })
      return
    }

    await postRegistration('/api/auth/register/email', {
      email,
      password: registrationData.password,
    }, 'email')
  }

  async function submitGoogleRegistration(idToken: string, accessToken: string = '') {
    await postRegistration('/api/auth/register/google', { idToken, accessToken }, 'social')
  }

  async function submitAppleRegistration(identityToken: string, user: unknown, state: string) {
    await postRegistration('/api/auth/register/apple', { identityToken, user, state }, 'social')
  }

  async function submitAppleMockRegistration() {
    const now = Date.now()
    await postRegistration('/api/auth/register/apple/mock', {
      mockEmail: `applemock+account+${now}@privaterelay.appleid.com`,
      mockName: 'Apple Mock Account',
      mockSub: `apple_mock_account_${now}`,
    }, 'social')
  }

  async function handleGoogleRegistration() {
    googleAuthIntentRef.current = 'register'

    if (!authConfig.googleClientId) {
      await handleGenericAuthTechnicalError(
        'HomePage.handleGoogleRegistration',
        'GOOGLE_CLIENT_ID non configurato nel backend.'
      )
      return
    }

    if (!await loadGoogleIdentitySdk()) {
      await handleGenericAuthTechnicalError('HomePage.handleGoogleRegistration', 'SDK Google non disponibile.')
      return
    }

    setIsRegistrationBusy(true)
    ensureGoogleClientsInitialized()

    if (googleTokenClientRef.current) {
      try {
        googleTokenClientRef.current.requestAccessToken({ prompt: 'select_account' })
      } catch {
        handleGooglePopupError({ type: 'unknown' })
      }
      return
    }

    if (!getGoogleAccounts()?.id) {
      await handleGenericAuthTechnicalError('HomePage.handleGoogleRegistration', 'SDK Google non disponibile.')
      setIsRegistrationBusy(false)
      return
    }

    const prompted = promptGoogleIdentity((notification) => {
      if (notification?.isNotDisplayed?.()) {
        setIsRegistrationBusy(false)
        void handleGenericAuthTechnicalError(
          'HomePage.handleGoogleRegistration',
          'Google non disponibile su questo browser. Riprova o usa Email.'
        )
      }
    })

    if (!prompted) {
      setIsRegistrationBusy(false)
    }
  }

  async function handleAppleRegistration() {
    if (authConfig.appleMockAuth) {
      await submitAppleMockRegistration()
      return
    }

    if (!authConfig.appleClientId || !authConfig.appleRedirectUri) {
      showToast('Metodo di registrazione ancora non disponibile', 'success')
      return
    }

    if (!window.AppleID?.auth) {
      await handleGenericAuthTechnicalError('HomePage.handleAppleRegistration', 'SDK Apple non disponibile.')
      return
    }

    setIsRegistrationBusy(true)

    try {
      const challenge = await getAppleAuthChallenge()
      window.AppleID.auth.init({
        clientId: authConfig.appleClientId,
        scope: 'name email',
        redirectURI: authConfig.appleRedirectUri,
        usePopup: true,
        nonce: challenge.nonce,
        state: challenge.state,
      })

      const response = await window.AppleID.auth.signIn()
      const identityToken = response?.authorization?.id_token ?? ''
      if (!identityToken) {
        throw new Error('Token Apple non disponibile.')
      }

      await submitAppleRegistration(identityToken, response?.user ?? null, challenge.state)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore autenticazione Apple.'
      if (message === 'Token Apple non disponibile.') {
        await handleGenericAuthTechnicalError('HomePage.handleAppleRegistration', message)
      } else {
        setRegistrationStatus({ type: 'error', message })
      }
      setIsRegistrationBusy(false)
    }
  }

  function renderCredentialLogin() {
    return (
      <section className="hero-login-panel" aria-label="Pannello di login">
        <div className="hero-login-head">
          <h2 className="hero-login-title">Accedi al tuo profilo</h2>
          <button className="hero-login-back" type="button" onClick={closeAuthView}>
            Torna alla home
          </button>
        </div>
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

          <div className="hero-login-submit-row">
            <button
              className="hero-login-action hero-login-primary"
              type="submit"
              disabled={isLoginBusy}
              aria-busy={isCredentialLoginBusy}
            >
              {isCredentialLoginBusy ? <span className="hero-login-button-spinner" aria-hidden="true" /> : null}
              <span>Login</span>
            </button>
            <button
              className="hero-forgot-password-link"
              type="button"
              disabled={isLoginBusy}
              onClick={() => {
                setForgotPasswordEmail(loginData.email)
                setIsForgotPasswordModalOpen(true)
              }}
            >
              Password dimenticata
            </button>
          </div>
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

  function renderRegistration() {
    return (
      <section className="hero-login-panel hero-register-panel" aria-label="Pannello di registrazione">
        <div className="hero-login-head">
          <h2 className="hero-login-title">Crea il tuo account</h2>
          <button className="hero-login-back" type="button" onClick={closeAuthView}>
            Torna alla home
          </button>
        </div>
        <p className="hero-login-subtitle">
          Un solo account per cercare assistenza e, quando vorrai, offrire i tuoi servizi.
        </p>

        <form className="hero-login-form" onSubmit={(event) => void handleEmailRegistration(event)}>
          <label className="hero-login-field">
            <span>Email</span>
            <input
              type="email"
              name="register-email"
              autoComplete="email"
              placeholder="nome@email.it"
              required
              value={registrationData.email}
              onChange={(event) => {
                setRegistrationData((current) => ({ ...current, email: event.target.value }))
                setRegistrationStatus(null)
              }}
            />
          </label>
          <div className="hero-register-password-grid">
            <label className="hero-login-field">
              <span>Password</span>
              <input
                type="password"
                name="register-password"
                autoComplete="new-password"
                placeholder="Inserisci password"
                required
                value={registrationData.password}
                onChange={(event) => {
                  setRegistrationData((current) => ({ ...current, password: event.target.value }))
                  setRegistrationStatus(null)
                }}
              />
            </label>
            <label className="hero-login-field">
              <span>Conferma Password</span>
              <input
                type="password"
                name="register-password-confirmation"
                autoComplete="new-password"
                placeholder="Conferma password"
                required
                value={registrationData.passwordConfirmation}
                onChange={(event) => {
                  setRegistrationData((current) => ({ ...current, passwordConfirmation: event.target.value }))
                  setRegistrationStatus(null)
                }}
              />
            </label>
          </div>

          <div className="hero-password-guidance" aria-live="polite">
            <strong>La password deve contenere:</strong>
            <div className="hero-password-rule-list">
              {[
                ['minLength', '10+ caratteri'],
                ['uppercase', '1 maiuscola'],
                ['lowercase', '1 minuscola'],
                ['number', '1 numero'],
                ['symbol', '1 simbolo'],
                ['noSpaces', 'nessuno spazio'],
              ].map(([key, label]) => {
                const isValid = registrationPasswordChecks[key as keyof PasswordChecks]
                return (
                  <span
                    key={key}
                    className={`hero-password-rule ${isValid ? 'is-valid' : hasRegistrationPasswordInput ? 'is-invalid' : ''}`}
                  >
                    {label}
                  </span>
                )
              })}
            </div>
          </div>

          {registrationData.passwordConfirmation && !isRegistrationConfirmationValid ? (
            <p className="hero-login-status is-error">Le password inserite non coincidono.</p>
          ) : null}

          {registrationStatus ? (
            <p className={`hero-login-status is-${registrationStatus.type}`} role="status">
              {registrationStatus.message}
            </p>
          ) : null}

          <button
            className="hero-login-action hero-login-primary"
            type="submit"
            disabled={isRegistrationBusy}
            aria-busy={isRegistrationBusy}
          >
            {isRegistrationBusy ? <span className="hero-login-button-spinner" aria-hidden="true" /> : null}
            <span>Registrati con Email</span>
          </button>
        </form>

        <div className="hero-login-divider" aria-hidden="true"><span>oppure</span></div>
        <div className="hero-login-socials">
          <button
            className="hero-login-social-btn"
            type="button"
            disabled={isRegistrationBusy}
            onClick={() => void handleGoogleRegistration()}
          >
            <GoogleIcon />
            Registrati con Google
          </button>
          <button
            className="hero-login-social-btn"
            type="button"
            disabled={isRegistrationBusy}
            onClick={() => void handleAppleRegistration()}
          >
            <AppleIcon />
            Registrati con Apple
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
            <img
              className="hero-animals-mobile"
              src={animaliImage}
              alt="Cani e gatti felici nel servizio Coccole Bestiali"
            />
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
                      {hasActiveAssistant ? (
                        <div className="portal-mode-switch" role="group" aria-label="Modalità del portale">
                          <button
                            type="button"
                            className={currentMode === 'owner' ? 'is-active' : ''}
                            aria-pressed={currentMode === 'owner'}
                            disabled={isModeBusy}
                            onClick={() => void switchPortalMode('owner')}
                          >
                            Owner
                          </button>
                          <button
                            type="button"
                            className={currentMode === 'assistant' ? 'is-active' : ''}
                            aria-pressed={currentMode === 'assistant'}
                            disabled={isModeBusy}
                            onClick={() => void switchPortalMode('assistant')}
                          >
                            Assistant
                          </button>
                        </div>
                      ) : null}
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
                        ref={loginTriggerRef}
                        className="action ghost"
                        type="button"
                        onClick={() => {
                          openAuthView('login', loginTriggerRef.current)
                        }}
                      >
                        Accedi
                      </button>
                      <button
                        ref={registerTriggerRef}
                        className="action solid"
                        type="button"
                        onClick={() => openAuthView('register', registerTriggerRef.current)}
                      >
                        Registrati
                      </button>
                    </>
                  )}
                </nav>
              </div>
              {authView === 'login' ? (
                renderCredentialLogin()
              ) : authView === 'register' ? (
                renderRegistration()
              ) : currentUser && currentMode === 'assistant' && hasActiveAssistant ? (
                <HomeActiveBookings key={currentUser.id} />
              ) : (
                <section className="hero-cta" aria-label="Call to action principale">
                  <p className="hero-kicker">SERVIZI PROFESSIONALI PER ANIMALI DOMESTICI</p>
                  <h1 className="hero-title">Trova la coccola perfetta per il tuo pet</h1>
                  <p className="hero-subtitle">
                    Assistenza affidabile, stile professionale, atmosfera accogliente.
                  </p>
                  <div className="hero-cta-actions">
                    <a className="cta-btn cta-primary" href="/search">
                      Cerca Un Pet Assistant
                    </a>
                    {showAssistantOnboardingCta ? (
                      <button
                        className="cta-btn cta-secondary"
                        type="button"
                        disabled={isAssistantOnboardingBusy}
                        onClick={() => void startAssistantOnboarding()}
                      >
                        {isAssistantOnboardingBusy
                          ? 'Apertura profilo...'
                          : hasAssistantDraft
                            ? 'Completa profilo Pet Assistant'
                            : 'Diventa Pet Assistant'}
                      </button>
                    ) : null}
                  </div>
                </section>
              )}
              <PublicFooter className="hero-legal" />
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

      {isForgotPasswordModalOpen ? (
        <div
          className="info-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Password dimenticata"
          onClick={() => setIsForgotPasswordModalOpen(false)}
        >
          <div className="info-modal forgot-password-modal" onClick={(event) => event.stopPropagation()}>
            <h2 className="info-modal-title">Password dimenticata</h2>
            <p className="info-modal-subtitle">
              Inserisci la tua email: ti invieremo una password temporanea per accedere.
            </p>
            <form className="info-modal-form" noValidate onSubmit={handleForgotPasswordSubmit}>
              <label className="info-field">
                <span>Email</span>
                <input
                  type="email"
                  name="forgot-password-email"
                  placeholder="nome@email.it"
                  value={forgotPasswordEmail}
                  onChange={(event) => setForgotPasswordEmail(event.target.value)}
                />
              </label>
              <div className="info-modal-actions">
                <button
                  type="button"
                  className="info-btn info-btn-cancel"
                  disabled={isForgotPasswordBusy}
                  onClick={() => setIsForgotPasswordModalOpen(false)}
                >
                  Annulla
                </button>
                <button type="submit" className="info-btn info-btn-submit" disabled={isForgotPasswordBusy}>
                  {isForgotPasswordBusy ? 'Invio...' : 'Invia password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isTemporaryPasswordModalOpen ? (
        <div
          className="info-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Imposta nuova password"
        >
          <form className="info-modal temporary-password-modal" onSubmit={handleTemporaryPasswordSubmit}>
            <h2 className="info-modal-title">Imposta nuova password</h2>
            <p className="info-modal-subtitle">
              Scegli la password definitiva per le tue credenziali di accesso.
            </p>
            <div className="temporary-password-grid">
              <label className="info-field">
                <span>Password</span>
                <input
                  type="password"
                  name="temporary-new-password"
                  placeholder="Inserisci password"
                  value={temporaryNewPassword}
                  onChange={(event) => setTemporaryNewPassword(event.target.value)}
                />
              </label>
              <label className="info-field">
                <span>Conferma Password</span>
                <input
                  type="password"
                  name="temporary-confirm-password"
                  placeholder="Ripeti password"
                  value={temporaryConfirmPassword}
                  onChange={(event) => setTemporaryConfirmPassword(event.target.value)}
                />
              </label>
            </div>
            <div className="temporary-password-rules" aria-label="Criteri password">
              <strong>La password deve contenere:</strong>
              <div className="temporary-password-rule-list">
                <span className={`temporary-password-rule ${temporaryPasswordChecks.minLength ? 'is-valid' : hasTemporaryPasswordInput ? 'is-invalid' : ''}`}>10+ caratteri</span>
                <span className={`temporary-password-rule ${temporaryPasswordChecks.uppercase ? 'is-valid' : hasTemporaryPasswordInput ? 'is-invalid' : ''}`}>1 maiuscola</span>
                <span className={`temporary-password-rule ${temporaryPasswordChecks.lowercase ? 'is-valid' : hasTemporaryPasswordInput ? 'is-invalid' : ''}`}>1 minuscola</span>
                <span className={`temporary-password-rule ${temporaryPasswordChecks.number ? 'is-valid' : hasTemporaryPasswordInput ? 'is-invalid' : ''}`}>1 numero</span>
                <span className={`temporary-password-rule ${temporaryPasswordChecks.symbol ? 'is-valid' : hasTemporaryPasswordInput ? 'is-invalid' : ''}`}>1 simbolo</span>
                <span className={`temporary-password-rule ${temporaryPasswordChecks.noSpaces ? 'is-valid' : hasTemporaryPasswordInput ? 'is-invalid' : ''}`}>nessuno spazio</span>
              </div>
            </div>
            {temporaryConfirmPassword.length > 0 && !isTemporaryPasswordConfirmationValid ? (
              <p className="temporary-password-mismatch">Le password inserite non coincidono.</p>
            ) : null}
            <div className="info-modal-actions">
              <button type="submit" className="info-btn info-btn-submit" disabled={isTemporaryPasswordSaving}>
                {isTemporaryPasswordSaving ? 'Salvataggio...' : 'Salva password'}
              </button>
            </div>
          </form>
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
