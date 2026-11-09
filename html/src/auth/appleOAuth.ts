import { csrfFetch } from './csrf'

export type AppleAuthChallenge = {
  nonce: string
  state: string
}

export async function getAppleAuthChallenge(): Promise<AppleAuthChallenge> {
  const response = await csrfFetch('/api/auth/apple/challenge', {
    method: 'POST',
    headers: { Accept: 'application/json' },
  })
  const payload = await response.json()
  const nonce = String(payload?.data?.nonce ?? '')
  const state = String(payload?.data?.state ?? '')

  if (!response.ok || !payload?.ok || !nonce || !state) {
    throw new Error('Challenge Apple non disponibile.')
  }

  return { nonce, state }
}
