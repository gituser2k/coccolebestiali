import { useEffect, useState } from 'react'
import { csrfHeaders } from '../auth/csrf'

type Favorite = { id: number; name: string; city: string; photoUrl: string }

export default function PetAssistantFavorites() {
  const [favorites, setFavorites] = useState<Favorite[] | null>(null)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<number | null>(null)

  useEffect(() => {
    const abort = new AbortController()
    void fetch('/api/pet-assistant-favorites', { signal: abort.signal, headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || !payload.ok) throw new Error(payload.message)
        setFavorites(payload.data)
      }).catch(() => {
        if (!abort.signal.aborted) setError('Preferiti momentaneamente non disponibili.')
      })
    return () => abort.abort()
  }, [])

  async function remove(id: number) {
    setRemoving(id)
    setError('')
    try {
      const response = await fetch(`/api/pet-assistants/${id}/favorite`, {
        method: 'PUT',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ favorite: false }),
      })
      if (!response.ok) throw new Error()
      setFavorites((current) => current?.filter((favorite) => favorite.id !== id) ?? null)
    } catch {
      setError('Impossibile rimuovere il preferito.')
    } finally {
      setRemoving(null)
    }
  }

  return <section aria-labelledby="favorites-heading">
    <h1 className="profile-stage-title" id="favorites-heading">Preferiti</h1>
    {error && <p role="alert">{error}</p>}
    {!favorites && !error && <p role="status">Caricamento preferiti…</p>}
    {favorites?.length === 0 && <p>Nessun Pet Assistant salvato. <a href="/search">Cerca un Pet Assistant</a>.</p>}
    {favorites && favorites.length > 0 && <ul className="profile-favorite-list">
      {favorites.map((favorite) => <li key={favorite.id}>
        {favorite.photoUrl ? <img src={favorite.photoUrl} alt="" /> : <span className="profile-favorite-initial" aria-hidden="true">{favorite.name.charAt(0).toUpperCase()}</span>}
        <div><a href={`/pet-assistants/${favorite.id}`}><strong>{favorite.name}</strong></a>{favorite.city && <p>{favorite.city}</p>}</div>
        <button type="button" className="profile-inline-action" disabled={removing !== null} onClick={() => void remove(favorite.id)} aria-label={`Rimuovi ${favorite.name} dai preferiti`}>Rimuovi</button>
      </li>)}
    </ul>}
  </section>
}
