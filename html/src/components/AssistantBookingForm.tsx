import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { csrfHeaders } from '../auth/csrf'
import { euros, formatDate } from './assistantFormatting'

export type AssistantService = {
  id: number
  name: string
  description: string
  hourlyRate: number
  features: { id: number; name: string }[]
}

export type AssistantSlot = {
  serviceId: number
  slotId: number
  date: string
  startTime: string
  endTime: string
  hourlyRateCents: number
}

type BookingDraft = {
  date: string
  calendarVersion?: number
  slotKey: string
  startTime: string
  endTime: string
  featureIds: number[]
}

type BookingResult = {
  id: number
  bookingNumber: string
  serviceName: string
  status: string
  notificationWarning?: boolean
}

type Props = {
  assistantId: number
  services: AssistantService[]
  slots: AssistantSlot[]
  pets: { id: number; name: string }[]
  viewerRole: string
  confirmationMode: string
  maxDuration: number
  minNotice: number
  cancelHours: number
  calendarDay: { date: string; version: number }
  availableDates: ReadonlySet<string>
  loadingSlots: boolean
  loginHref: string
  onRefresh: () => void
}

function parseMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function timeOptions(from: number, to: number): string[] {
  return Array.from({ length: Math.max(0, Math.floor((to - from) / 30) + 1) }, (_, index) => {
    const minutes = from + index * 30
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  })
}

function slotKey(slot: AssistantSlot): string {
  return `${slot.slotId}:${slot.startTime}:${slot.endTime}`
}

function initialDrafts(services: AssistantService[], key: string): Record<number, BookingDraft> {
  try {
    const stored = window.sessionStorage.getItem(key)
    if (stored) return JSON.parse(stored) as Record<number, BookingDraft>
  } catch {
    // The form can still be used without tab storage.
  }
  const params = new URLSearchParams(window.location.search)
  const serviceIds = (params.get('services') ?? '').split(',').map(Number)
  const options = Object.fromEntries(params.getAll('options').map((value) => value.split(':', 2)))
  return Object.fromEntries(services.filter((service) => serviceIds.includes(service.id)).map((service) => [
    service.id,
    {
      date: '',
      slotKey: '',
      startTime: '',
      endTime: '',
      featureIds: service.features.filter((feature) => (options[service.id] ?? '').split(',').map(Number).includes(feature.id)).map(({ id }) => id),
    },
  ]))
}

export default function AssistantBookingForm(props: Props) {
  const { assistantId, services, slots, pets, viewerRole, confirmationMode, maxDuration, minNotice, cancelHours, calendarDay, availableDates, loadingSlots, loginHref, onRefresh } = props
  const storageKey = `cb_booking_draft:${assistantId}:${window.location.search}`
  const [drafts, setDrafts] = useState(() => initialDrafts(services, storageKey))
  const [petId, setPetId] = useState(pets[0]?.id ?? 0)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ text: string; serviceId?: number } | null>(null)
  const [bookings, setBookings] = useState<BookingResult[]>([])
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null)
  const inFlight = useRef(false)

  const items = services.filter((service) => drafts[service.id]).map((service) => {
    const draft = drafts[service.id]
    const serviceSlots = slots.filter((slot) => slot.serviceId === service.id)
    const serviceDates = new Set(serviceSlots.map((slot) => slot.date))
    const followsCalendar = (draft.calendarVersion ?? 0) !== calendarDay.version || !draft.date
    const chosenDate = followsCalendar ? calendarDay.date : draft.date
    const date = availableDates.has(chosenDate) ? chosenDate : ''
    const daySlots = serviceSlots.filter((slot) => slot.date === date)
    const slot = followsCalendar ? undefined : daySlots.find((candidate) => slotKey(candidate) === draft.slotKey)
    const starts = slot ? timeOptions(parseMinutes(slot.startTime), parseMinutes(slot.endTime) - 30) : []
    const start = starts.includes(draft.startTime) ? draft.startTime : starts[0] ?? ''
    const ends = slot ? timeOptions(parseMinutes(start) + 30, Math.min(parseMinutes(slot.endTime), parseMinutes(start) + maxDuration)) : []
    const end = ends.includes(draft.endTime) ? draft.endTime : ends[0] ?? ''
    const subtotal = slot && start && end ? Math.round(slot.hourlyRateCents * (parseMinutes(end) - parseMinutes(start)) / 60) : null
    return { service, draft, serviceDates, date, daySlots, slot, starts, ends, start, end, subtotal }
  })
  const total = items.reduce((sum, item) => sum + (item.subtotal ?? 0), 0)
  const complete = items.length > 0 && items.every((item) => item.subtotal !== null)

  function changeDraft(serviceId: number, changes: Partial<BookingDraft>) {
    setDrafts((current) => ({ ...current, [serviceId]: { ...current[serviceId], ...changes } }))
    setError(null)
  }

  function toggleService(serviceId: number, enabled: boolean) {
    setDrafts((current) => {
      if (enabled) return { ...current, [serviceId]: { date: '', slotKey: '', startTime: '', endTime: '', featureIds: [] } }
      const next = { ...current }
      delete next[serviceId]
      return next
    })
    setError(null)
  }

  function rememberDraft() {
    try {
      const draftForLogin = Object.fromEntries(items.map(({ service, draft, date, slot, start, end }) => [service.id, {
        ...draft, date, calendarVersion: 0, slotKey: slot ? slotKey(slot) : '', startTime: start, endTime: end,
      }]))
      window.sessionStorage.setItem(storageKey, JSON.stringify(draftForLogin))
    } catch {
      // The login link remains usable without tab storage.
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || loadingSlots || viewerRole !== 'pet_owner' || !petId || !complete) return
    const payload = {
      assistantUserId: assistantId,
      petId,
      items: items.map(({ service, draft, slot, date, start, end, subtotal }) => ({
        serviceId: service.id, slotId: slot?.slotId, date, startTime: start, endTime: end,
        featureIds: draft.featureIds, message, expectedTotalCents: subtotal,
      })),
    }
    const fingerprint = JSON.stringify(payload)
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { fingerprint, key: crypto.randomUUID() }
    }
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/bookings/batch', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ ...payload, requestKey: attempt.current.key }),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) {
        const item = Number.isInteger(result.itemIndex) ? items[result.itemIndex] : undefined
        if (item) {
          setDrafts((current) => ({
            ...current, [item.service.id]: { ...current[item.service.id], slotKey: '', startTime: '', endTime: '' },
          }))
          onRefresh()
        }
        setError({ text: result.message || 'Prenotazione non completata.', serviceId: item?.service.id })
        return
      }
      setBookings(result.data.bookings)
      try { window.sessionStorage.removeItem(storageKey) } catch { /* storage is optional */ }
      onRefresh()
    } catch {
      setError({ text: 'Risposta non ricevuta. Riprova lo stesso invio per verificare la prenotazione.' })
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <aside className="public-booking public-panel" id="prenota" tabIndex={-1} aria-labelledby="public-booking-title">
      <h2 id="public-booking-title">Prenota un servizio</h2>
      {bookings.length > 0 ? (
        <div role="status" className="public-booking-confirmed">
          <strong>{bookings.every((booking) => booking.status === 'confirmed') ? 'Prenotazione confermata' : 'Richiesta inviata'}</strong>
          <ul>{bookings.map((booking) => <li key={booking.id}>{booking.serviceName} · {booking.bookingNumber}</li>)}</ul>
          {bookings.some((booking) => booking.notificationWarning) ? <p>Le prenotazioni sono registrate. Alcune notifiche email non sono partite.</p> : null}
          <a href="/profile/petowner?section=bookings">Apri le mie prenotazioni</a>
        </div>
      ) : services.length === 0 ? <p>Nessun servizio prenotabile al momento.</p> : (
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="public-booking-fields">
            <legend className="public-visually-hidden">Dati della prenotazione</legend>
            {viewerRole === 'pet_owner' && pets.length > 0 ? (
              <label className="public-field">Il tuo pet
                <select value={petId} onChange={(event) => setPetId(Number(event.target.value))}>
                  {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
                </select>
              </label>
            ) : null}
            <fieldset className="public-booking-services">
              <legend>Servizi</legend>
              {services.map((service) => (
                <label key={service.id} className="public-choice">
                  <input type="checkbox" checked={Boolean(drafts[service.id])} onChange={(event) => toggleService(service.id, event.target.checked)} />
                  <span>{service.name}</span><small>{euros(Math.round(service.hourlyRate * 100))}/ora</small>
                </label>
              ))}
            </fieldset>
            {items.map(({ service, draft, serviceDates, date, daySlots, slot, starts, ends, start, end, subtotal }) => (
              <fieldset key={service.id} className="public-booking-item">
                <legend>{service.name}</legend>
                {service.features.length ? <div className="public-feature-choices"><strong>Opzioni di interesse</strong>
                  {service.features.map((feature) => (
                    <label key={feature.id} className="public-choice">
                      <input type="checkbox" checked={draft.featureIds.includes(feature.id)} onChange={(event) => changeDraft(service.id, {
                        featureIds: event.target.checked ? [...draft.featureIds, feature.id] : draft.featureIds.filter((id) => id !== feature.id),
                      })} />
                      <span>{feature.name}</span>
                    </label>
                  ))}
                </div> : null}
                <label className="public-field">Data
                  <select value={date} disabled={loadingSlots || !availableDates.size} onChange={(event) => changeDraft(service.id, { date: event.target.value, calendarVersion: calendarDay.version, slotKey: '', startTime: '', endTime: '' })}>
                    <option value="" disabled>{loadingSlots ? 'Caricamento…' : availableDates.size ? 'Scegli una data' : 'Nessuna data disponibile'}</option>
                    {[...availableDates].map((value) => <option key={value} value={value}>
                      {formatDate(value)}{serviceDates.has(value) ? '' : ' · senza fasce per questo servizio'}
                    </option>)}
                  </select>
                </label>
                {date && !daySlots.length && !loadingSlots ? <p className="public-muted">Nessuna fascia per questo servizio nella data scelta.</p> : null}
                {daySlots.length > 0 ? <label className="public-field">Fascia
                  <select value={slot ? slotKey(slot) : ''} onChange={(event) => changeDraft(service.id, { date, calendarVersion: calendarDay.version, slotKey: event.target.value, startTime: '', endTime: '' })}>
                    <option value="">Scegli una fascia</option>
                    {daySlots.map((option) => <option key={slotKey(option)} value={slotKey(option)}>{option.startTime}–{option.endTime} · {euros(option.hourlyRateCents)}/ora</option>)}
                  </select>
                </label> : null}
                {slot ? <div className="public-date-range">
                  <label className="public-field">Inizio<select value={start} onChange={(event) => changeDraft(service.id, { startTime: event.target.value, endTime: '' })}>{starts.map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label className="public-field">Fine<select value={end} onChange={(event) => changeDraft(service.id, { endTime: event.target.value })}>{ends.map((value) => <option key={value}>{value}</option>)}</select></label>
                </div> : null}
                {subtotal !== null ? <p className="public-subtotal">Subtotale <strong>{euros(subtotal)}</strong></p> : null}
                {error?.serviceId === service.id ? <p role="alert" className="public-error">{error.text}</p> : null}
              </fieldset>
            ))}
            {viewerRole === 'pet_owner' && items.length > 0 ? <label className="public-field">Messaggio per il Pet Assistant
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={2} maxLength={4096} />
            </label> : null}
          </fieldset>
          <div className="public-total">Totale <strong>{complete ? euros(total) : '—'}</strong></div>
          {error && error.serviceId === undefined ? <p role="alert" className="public-error">{error.text}</p> : null}
          {viewerRole === 'pet_owner' ? (
            pets.length ? <button type="submit" className="public-primary" disabled={busy || loadingSlots || !complete}>{busy ? 'Invio in corso…' : 'Prenota'}</button>
              : <a className="public-primary" href="/profile/petowner?section=pets">Aggiungi il tuo pet</a>
          ) : !viewerRole ? <a className="public-primary" href={loginHref} onClick={rememberDraft}>Accedi per prenotare</a>
            : <p>La prenotazione è disponibile dal profilo Pet Owner.</p>}
          <p className="public-muted">{confirmationMode === 'automatic' ? 'Conferma immediata.' : 'Richiede conferma del Pet Assistant.'} Prenota con almeno {minNotice} ore di anticipo. Annullamento senza penalità fino a {cancelHours} ore prima.</p>
        </form>
      )}
    </aside>
  )
}
