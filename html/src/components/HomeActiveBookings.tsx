import { useEffect, useState } from 'react'
import { formatDate } from './assistantFormatting'

type ActiveBooking = {
  id: number
  serviceName: string
  petName: string
  date: string
  startTime: string
  endTime: string
  status: 'pending' | 'confirmed' | 'reschedule_pending'
}

const statuses = {
  pending: 'In attesa di risposta',
  confirmed: 'Confermata',
  reschedule_pending: 'Riprogrammazione proposta',
}

export default function HomeActiveBookings() {
  const [bookings, setBookings] = useState<ActiveBooking[] | null>(null)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const abort = new AbortController()
    void fetch('/api/bookings/active-for-assistant', { signal: abort.signal, headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || !payload.ok) throw new Error()
        setBookings(payload.data)
      }).catch(() => {
        if (!abort.signal.aborted) setError(true)
      })

    return () => abort.abort()
  }, [revision])

  return <section className="hero-cta hero-assistant-bookings" aria-label="Prenotazioni attive">
    {error ? <div className="hero-bookings-empty" role="alert">
      <p>Non è stato possibile caricare le prenotazioni.</p>
      <button type="button" className="cta-btn cta-primary" onClick={() => { setError(false); setRevision((current) => current + 1) }}>Riprova</button>
    </div> : !bookings ? <p className="hero-bookings-empty" role="status">Caricamento prenotazioni…</p>
      : bookings.length === 0 ? <h1 className="hero-bookings-empty">Nessuna Prenotazione da gestire</h1>
      : <>
        <h1 className="hero-bookings-title">Prenotazioni attive</h1>
        <ul className="hero-bookings-list" tabIndex={0} aria-label="Elenco prenotazioni attive">
          {bookings.map((booking) => <li key={booking.id}>
            <div><strong>{booking.serviceName} · {booking.petName}</strong>
              <small><time dateTime={booking.date}>{formatDate(booking.date)}</time> · {booking.startTime}–{booking.endTime}</small></div>
            <span>{statuses[booking.status]}</span>
          </li>)}
        </ul>
        <a className="cta-btn cta-primary" href="/profile/petassistant?section=bookings">Gestisci prenotazioni</a>
      </>}
  </section>
}
