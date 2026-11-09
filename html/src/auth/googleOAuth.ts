import { csrfFetch } from './csrf'

export type GoogleTokenResponse = {
  access_token?: string
  error?: string
}

export type GooglePopupError = {
  type?: 'popup_closed' | 'popup_failed_to_open' | 'unknown' | string
}

export type GoogleTokenClient = {
  requestAccessToken: (params?: { prompt?: string }) => void
}

type GooglePromptNotification = {
  isNotDisplayed?: () => boolean
}

type GoogleAccounts = {
  id?: {
    initialize: (params: {
      client_id: string
      callback: (response: { credential?: string }) => void
    }) => void
    prompt: (callback?: (notification: GooglePromptNotification) => void) => void
  }
  oauth2?: {
    initTokenClient: (params: {
      client_id: string
      scope: string
      callback: (response: GoogleTokenResponse) => void
      error_callback: (error: GooglePopupError) => void
    }) => GoogleTokenClient
  }
}

declare global {
  interface Window {
    google?: {
      accounts?: GoogleAccounts
    }
  }
}

export function getGoogleAccounts(): GoogleAccounts | undefined {
  return window.google?.accounts
}

let googleSdkPromise: Promise<boolean> | null = null

export function loadGoogleIdentitySdk(timeoutMs: number = 10000): Promise<boolean> {
  if (getGoogleAccounts()) return Promise.resolve(true)
  if (googleSdkPromise) return googleSdkPromise

  googleSdkPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
    const script = existing ?? document.createElement('script')
    let settled = false
    let poll = 0
    const finish = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      window.clearInterval(poll)
      resolve(Boolean(getGoogleAccounts()))
    }
    const timeout = window.setTimeout(finish, timeoutMs)
    poll = window.setInterval(() => {
      if (getGoogleAccounts()) finish()
    }, 50)

    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', finish, { once: true })
    if (!existing) {
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }).finally(() => {
    if (!getGoogleAccounts()) {
      document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')?.remove()
      googleSdkPromise = null
    }
  })

  return googleSdkPromise!
}

export function initializeGoogleIdentity(
  clientId: string,
  callback: (response: { credential?: string }) => void
): boolean {
  const identity = getGoogleAccounts()?.id
  if (!clientId || !identity) {
    return false
  }

  identity.initialize({
    client_id: clientId,
    callback,
  })

  return true
}

export function initializeGoogleTokenClient(
  clientId: string,
  callback: (response: GoogleTokenResponse) => void,
  errorCallback: (error: GooglePopupError) => void
): GoogleTokenClient | null {
  const oauth = getGoogleAccounts()?.oauth2
  if (!clientId || !oauth) {
    return null
  }

  return oauth.initTokenClient({
    client_id: clientId,
    scope: 'openid email profile',
    callback,
    error_callback: errorCallback,
  })
}

export function promptGoogleIdentity(
  callback: (notification: GooglePromptNotification) => void
): boolean {
  const identity = getGoogleAccounts()?.id
  if (!identity) {
    return false
  }

  identity.prompt(callback)
  return true
}

export function getGooglePopupMessage(error: GooglePopupError): string {
  if (error.type === 'popup_closed') {
    return 'Accesso Google annullato.'
  }

  if (error.type === 'popup_failed_to_open') {
    return 'Impossibile aprire Google. Consenti i popup e riprova.'
  }

  return 'Autenticazione Google annullata o non riuscita.'
}

export async function fetchAuthRequest(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number = 15000
): Promise<Response> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await csrfFetch(input, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timeout)
  }
}
