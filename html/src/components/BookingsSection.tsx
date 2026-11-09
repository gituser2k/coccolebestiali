import { csrfHeaders } from '../auth/csrf'
import { useEffect, useState } from 'react'

export function BookingsIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M6.5 3.5v3M17.5 3.5v3M4 8.5h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m8 14 2.2 2.2L16 11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type BookingStatus = 'pending' | 'confirmed' | 'reschedule_pending' | 'declined' | 'cancelled' | 'expired' | 'completed'
type BookingsView = 'active' | 'history'

type BookingData = {
  id: number
  bookingNumber: string
  ownerName: string
  assistantName: string
  petName: string
  serviceName: string
  date: string
  startTime: string
  endTime: string
  totalPrice: number
  message: string
  preferredFeatures: { id: number; name: string }[]
  status: BookingStatus
  confirmationMode: 'manual' | 'automatic'
  responseDeadline: number
  cancellationReason: string
  canReview: boolean
  reviewSent: boolean
  reschedule: null | {
    date: string
    startTime: string
    endTime: string
    totalPrice: number
    message: string
    status: string
  }
}

type AlternativeSlot = {
  slotId: number
  date: string
  startTime: string
  endTime: string
  hourlyRate: number
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'In attesa',
  confirmed: 'Confermata',
  reschedule_pending: 'Nuova proposta',
  declined: 'Rifiutata',
  cancelled: 'Annullata',
  expired: 'Scaduta',
  completed: 'Completata',
}

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'reschedule_pending']

function formatDate(value: string) {
  return new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)
}

export default function BookingsSection({ role }: { role: 'pet_owner' | 'pet_assistant' }) {
  const [bookings, setBookings] = useState<BookingData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState(0)
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null)
  const [reviewBooking, setReviewBooking] = useState<BookingData | null>(null)
  const [reviewSentiment, setReviewSentiment] = useState<'positive' | 'negative'>('positive')
  const [reviewComment, setReviewComment] = useState('')
  const [publishReview, setPublishReview] = useState(false)
  const [rescheduleBooking, setRescheduleBooking] = useState<BookingData | null>(null)
  const [alternatives, setAlternatives] = useState<AlternativeSlot[]>([])
  const [selectedAlternative, setSelectedAlternative] = useState(0)
  const [rescheduleMessage, setRescheduleMessage] = useState('')
  const [cancellationBooking, setCancellationBooking] = useState<BookingData | null>(null)
  const [bookingsView, setBookingsView] = useState<BookingsView>('active')

  const activeBookings = bookings.filter((booking) => ACTIVE_BOOKING_STATUSES.includes(booking.status))
  const bookingHistory = bookings.filter((booking) => !ACTIVE_BOOKING_STATUSES.includes(booking.status))
  const visibleBookings = bookingsView === 'active' ? activeBookings : bookingHistory

  useEffect(() => { void loadBookings() }, [])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 6000)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function loadBookings() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/bookings', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      const payload = await response.json()
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || 'Caricamento prenotazioni non completato.')
      setBookings(payload.data)
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Caricamento prenotazioni non completato.', error: true })
    } finally {
      setIsLoading(false)
    }
  }

  async function runAction(bookingId: number, action: string, body: Record<string, unknown> = {}) {
    setBusyId(bookingId)
    try {
      const response = await fetch(`/api/bookings/${bookingId}/${action}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...csrfHeaders() },
        body: JSON.stringify(body),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || 'Operazione non completata.')
      setToast({
        message: payload.data?.notificationWarning ? 'Operazione completata. Invio email non completato.' : 'Operazione completata.',
        error: Boolean(payload.data?.notificationWarning),
      })
      await loadBookings()
      return true
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Operazione non completata.', error: true })
      return false
    } finally {
      setBusyId(0)
    }
  }

  async function openReschedule(booking: BookingData) {
    setBusyId(booking.id)
    try {
      const response = await fetch(`/api/bookings/${booking.id}/alternatives`, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      const payload = await response.json()
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || 'Fasce alternative non disponibili.')
      setAlternatives(payload.data)
      setSelectedAlternative(payload.data[0]?.slotId ?? 0)
      setRescheduleMessage('')
      setRescheduleBooking(booking)
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Fasce alternative non disponibili.', error: true })
    } finally {
      setBusyId(0)
    }
  }

  async function submitReschedule() {
    const slot = alternatives.find((item) => item.slotId === selectedAlternative)
    if (!rescheduleBooking || !slot || !rescheduleMessage.trim()) {
      setToast({ message: 'Seleziona una fascia e indica il motivo della proposta.', error: true })
      return
    }
    const duration = Math.max(30, Math.round((new Date(`1970-01-01T${rescheduleBooking.endTime}:00`).getTime() - new Date(`1970-01-01T${rescheduleBooking.startTime}:00`).getTime()) / 60000))
    const startMinutes = Number(slot.startTime.slice(0, 2)) * 60 + Number(slot.startTime.slice(3, 5))
    const proposedEnd = startMinutes + duration
    const endTime = `${String(Math.floor(proposedEnd / 60)).padStart(2, '0')}:${String(proposedEnd % 60).padStart(2, '0')}`
    const ok = await runAction(rescheduleBooking.id, 'reschedule', { slotId: slot.slotId, date: slot.date, startTime: slot.startTime, endTime, message: rescheduleMessage })
    if (ok) setRescheduleBooking(null)
  }

  async function submitReview() {
    if (!reviewBooking || !reviewComment.trim()) {
      setToast({ message: 'Scrivi una breve spiegazione della recensione.', error: true })
      return
    }
    const ok = await runAction(reviewBooking.id, 'review', { sentiment: reviewSentiment, comment: reviewComment, publishComment: publishReview })
    if (ok) setReviewBooking(null)
  }

  async function confirmCancellation() {
    if (!cancellationBooking) return

    const ok = await runAction(cancellationBooking.id, 'cancel', {
      reason: 'Annullamento richiesto dal profilo.',
    })
    if (ok) setCancellationBooking(null)
  }

  return (
    <section className="profile-bookings-section">
      <div className="profile-bookings-header">
        <h1 className="profile-stage-title">Le mie prenotazioni</h1>
        <div className="profile-bookings-view-tabs" role="tablist" aria-label="Visualizza prenotazioni">
          <button
            id="bookings-active-tab"
            type="button"
            role="tab"
            aria-selected={bookingsView === 'active'}
            aria-controls="bookings-view-panel"
            className={bookingsView === 'active' ? 'is-active' : ''}
            onClick={() => setBookingsView('active')}
          >
            Attive <span>{activeBookings.length}</span>
          </button>
          <button
            id="bookings-history-tab"
            type="button"
            role="tab"
            aria-selected={bookingsView === 'history'}
            aria-controls="bookings-view-panel"
            className={bookingsView === 'history' ? 'is-active' : ''}
            onClick={() => setBookingsView('history')}
          >
            Storico <span>{bookingHistory.length}</span>
          </button>
        </div>
      </div>
      {isLoading ? <div className="profile-loading-card">Caricamento prenotazioni in corso...</div> : null}
      <div
        id="bookings-view-panel"
        className="profile-bookings-list"
        role="tabpanel"
        aria-labelledby={bookingsView === 'active' ? 'bookings-active-tab' : 'bookings-history-tab'}
      >
        {!isLoading && visibleBookings.length === 0 ? (
          <div className="profile-bookings-empty">
            <strong>{bookingsView === 'active' ? 'Nessuna prenotazione attiva' : 'Lo storico è ancora vuoto'}</strong>
            <span>{bookingsView === 'active' ? 'Le nuove richieste e i servizi confermati compariranno qui.' : 'Le prenotazioni concluse, annullate, rifiutate o scadute compariranno qui.'}</span>
          </div>
        ) : null}
        {visibleBookings.map((booking) => {
          const actionable = ACTIVE_BOOKING_STATUSES.includes(booking.status)
          return (
            <article className={`profile-booking-card is-${booking.status}`} key={booking.id}>
              <header><div><span>{booking.bookingNumber}</span><h2>{booking.serviceName}</h2></div><strong>{STATUS_LABELS[booking.status]}</strong></header>
              <div className="profile-booking-facts">
                <div><span>{role === 'pet_owner' ? 'Pet Assistant' : 'Pet Owner'}</span><strong>{role === 'pet_owner' ? booking.assistantName : booking.ownerName}</strong></div>
                <div><span>Pet</span><strong>{booking.petName}</strong></div>
                <div><span>Quando</span><strong>{formatDate(booking.date)} · {booking.startTime}–{booking.endTime}</strong></div>
                <div><span>Totale</span><strong>{formatPrice(booking.totalPrice)}</strong></div>
              </div>
              {booking.preferredFeatures.length > 0 ? (
                <div className="profile-booking-preferences">
                  <strong>Preferenze richieste</strong>
                  <div>{booking.preferredFeatures.map((feature) => <span key={feature.id}>{feature.name}</span>)}</div>
                </div>
              ) : null}
              {booking.message ? <p className="profile-booking-message">{booking.message}</p> : null}
              {booking.reschedule?.status === 'pending' ? <div className="profile-booking-proposal"><strong>Nuova proposta</strong><span>{formatDate(booking.reschedule.date)} · {booking.reschedule.startTime}–{booking.reschedule.endTime} · {formatPrice(booking.reschedule.totalPrice)}</span><p>{booking.reschedule.message}</p></div> : null}
              <div className="profile-booking-actions">
                {role === 'pet_assistant' && booking.status === 'pending' ? <button onClick={() => void runAction(booking.id, 'accept')} disabled={busyId === booking.id}>Accetta</button> : null}
                {role === 'pet_assistant' && booking.status === 'pending' ? <button className="is-outline" onClick={() => void runAction(booking.id, 'decline', { reason: 'Richiesta non disponibile.' })} disabled={busyId === booking.id}>Rifiuta</button> : null}
                {role === 'pet_assistant' && ['pending', 'confirmed'].includes(booking.status) ? <button className="is-outline" onClick={() => void openReschedule(booking)} disabled={busyId === booking.id}>Proponi nuovo orario</button> : null}
                {role === 'pet_owner' && booking.status === 'reschedule_pending' ? <button onClick={() => void runAction(booking.id, 'reschedule/respond', { accept: true })} disabled={busyId === booking.id}>Accetta proposta</button> : null}
                {role === 'pet_owner' && booking.status === 'reschedule_pending' ? <button className="is-outline" onClick={() => void runAction(booking.id, 'reschedule/respond', { accept: false })} disabled={busyId === booking.id}>Rifiuta proposta</button> : null}
                {actionable ? <button className="is-danger" onClick={() => setCancellationBooking(booking)} disabled={busyId === booking.id}>Annulla</button> : null}
                {booking.canReview ? <button onClick={() => { setReviewBooking(booking); setReviewComment(''); setReviewSentiment('positive'); setPublishReview(false) }}>Lascia una recensione</button> : null}
              </div>
            </article>
          )
        })}
      </div>

      {reviewBooking ? <div className="profile-booking-modal-backdrop"><section className="profile-booking-modal" role="dialog" aria-modal="true"><h2>Recensione {reviewBooking.bookingNumber}</h2><div className="profile-review-choice"><button className={reviewSentiment === 'positive' ? 'is-selected' : ''} onClick={() => setReviewSentiment('positive')}>Positiva +5</button><button className={reviewSentiment === 'negative' ? 'is-selected is-negative' : ''} onClick={() => setReviewSentiment('negative')}>Negativa -5</button></div><textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} maxLength={4096} placeholder="Racconta la tua esperienza." />
        {role === 'pet_owner' ? <label className="profile-public-location"><input type="checkbox" checked={publishReview} onChange={(event) => setPublishReview(event.target.checked)} />
          <span>Acconsento a mostrare il testo di questa recensione sul profilo pubblico del Pet Assistant.</span></label> : null}
        <div className="profile-booking-modal-actions"><button className="is-outline" onClick={() => setReviewBooking(null)}>Chiudi</button><button onClick={() => void submitReview()}>Invia recensione</button></div></section></div> : null}

      {rescheduleBooking ? <div className="profile-booking-modal-backdrop"><section className="profile-booking-modal" role="dialog" aria-modal="true"><h2>Proponi un nuovo orario</h2>{alternatives.length > 0 ? <select className="portal-combobox" value={selectedAlternative} onChange={(event) => setSelectedAlternative(Number(event.target.value))}>{alternatives.map((slot) => <option key={slot.slotId} value={slot.slotId}>{formatDate(slot.date)} · {slot.startTime}–{slot.endTime}</option>)}</select> : <p>Nessuna fascia alternativa disponibile.</p>}<textarea value={rescheduleMessage} onChange={(event) => setRescheduleMessage(event.target.value)} maxLength={4096} placeholder="Spiega la proposta al Pet Owner." /><div className="profile-booking-modal-actions"><button className="is-outline" onClick={() => setRescheduleBooking(null)}>Chiudi</button><button onClick={() => void submitReschedule()} disabled={alternatives.length === 0}>Invia proposta</button></div></section></div> : null}
      {cancellationBooking ? (
        <div className="profile-booking-modal-backdrop">
          <section className="profile-booking-modal profile-booking-cancel-modal" role="dialog" aria-modal="true" aria-labelledby="booking-cancel-title">
            <span className="profile-booking-cancel-icon" aria-hidden="true">!</span>
            <h2 id="booking-cancel-title">Annullare la prenotazione?</h2>
            <p>
              Stai per annullare la prenotazione <strong>{cancellationBooking.bookingNumber}</strong> per il servizio <strong>{cancellationBooking.serviceName}</strong>.
            </p>
            <p className="profile-booking-cancel-warning">
              Questa operazione è irreversibile: la prenotazione non potrà più essere ripristinata.
            </p>
            <div className="profile-booking-modal-actions">
              <button className="is-outline" type="button" onClick={() => setCancellationBooking(null)} disabled={busyId === cancellationBooking.id}>Chiudi</button>
              <button className="is-danger" type="button" onClick={() => void confirmCancellation()} disabled={busyId === cancellationBooking.id}>
                {busyId === cancellationBooking.id ? 'Annullamento...' : 'Annulla definitivamente'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {toast ? <div className={`profile-booking-toast ${toast.error ? 'is-error' : 'is-success'}`}>{toast.message}</div> : null}
    </section>
  )
}
