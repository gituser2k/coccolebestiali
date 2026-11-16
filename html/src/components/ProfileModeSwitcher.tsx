import { useEffect, useState } from 'react'
import { csrfFetch as fetch } from '../auth/csrf'

type Mode = 'owner' | 'assistant'

type PortalModeState = {
  activeAssistant: boolean
  assistantStarted: boolean
  assistantStatus: string
  current: Mode
}

export default function ProfileModeSwitcher({ currentMode, refreshToken }: { currentMode: Mode; refreshToken?: string | number }) {
  const [state, setState] = useState<PortalModeState>({ activeAssistant: currentMode === 'assistant', assistantStarted: currentMode === 'assistant', assistantStatus: currentMode === 'assistant' ? 'active' : '', current: currentMode })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/auth/me', { headers: { Accept: 'application/json' } })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || !payload?.ok) return
        const user = payload?.data?.user ?? {}
        const capabilities = Array.isArray(user.capabilities) ? user.capabilities : []
        const assistantCapability = capabilities.find((item: Record<string, unknown>) => item?.capability === 'assistant')
        const activeAssistant = Array.isArray(user.activeCapabilities) && user.activeCapabilities.includes('assistant')
        const nextState: PortalModeState = {
          activeAssistant: Array.isArray(user.activeCapabilities) && user.activeCapabilities.includes('assistant'),
          assistantStarted: capabilities.some((item: Record<string, unknown>) => item?.capability === 'assistant'),
          assistantStatus: typeof assistantCapability?.status === 'string' ? assistantCapability.status : '',
          current: user?.modes?.current === 'assistant' ? 'assistant' : 'owner',
        }
        if ((currentMode === 'owner' || activeAssistant) && nextState.current !== currentMode) {
          const modeResponse = await fetch('/api/auth/mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ mode: currentMode }),
          })
          if (modeResponse.ok) nextState.current = currentMode
        }
        setState(nextState)
      } catch {
        setError('Modalità profilo non disponibile.')
      }
    })()
  }, [currentMode, refreshToken])

  async function switchMode(mode: Mode) {
    if (busy) return
    try {
      setBusy(true)
      setError('')
      const response = await fetch('/api/auth/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || 'Cambio modalità non completato.')
      window.location.assign(mode === 'assistant' ? '/profile/petassistant?entry=login' : '/profile/petowner?entry=login')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Cambio modalità non completato.')
      setBusy(false)
    }
  }

  async function openAssistantProfile() {
    if (busy) return
    try {
      setBusy(true)
      setError('')
      const response = await fetch('/api/profile/petassistant/onboarding/start', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || 'Avvio profilo non completato.')
      window.location.assign('/profile/petassistant?onboarding=1&section=personal')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Avvio profilo non completato.')
      setBusy(false)
    }
  }

  return (
    <div className="profile-mode-control" aria-label="Modalità del profilo">
      <div className="profile-mode-buttons" role="group" aria-label="Passa da Pet Owner a Pet Assistant">
        <button
          type="button"
          className={state.current === 'owner' ? 'is-active' : ''}
          aria-pressed={state.current === 'owner'}
          disabled={busy || state.current === 'owner'}
          onClick={() => void switchMode('owner')}
        >
          Pet Owner
        </button>
        {state.activeAssistant ? (
          <button
            type="button"
            className={state.current === 'assistant' ? 'is-active' : ''}
            aria-pressed={state.current === 'assistant'}
            disabled={busy || state.current === 'assistant'}
            onClick={() => void switchMode('assistant')}
          >
            Pet Assistant
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || ['suspended', 'rejected', 'disabled'].includes(state.assistantStatus)}
            onClick={() => void openAssistantProfile()}
          >
            {['suspended', 'rejected', 'disabled'].includes(state.assistantStatus)
              ? 'Profilo Assistant non disponibile'
              : state.assistantStarted ? 'Completa profilo Assistant' : 'Diventa Pet Assistant'}
          </button>
        )}
      </div>
      {error ? <small className="profile-mode-error" role="alert">{error}</small> : null}
    </div>
  )
}
