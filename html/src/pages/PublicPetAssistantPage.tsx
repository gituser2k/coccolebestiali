import PublicFooter from '../components/PublicFooter'
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import logo from '../assets/logo.png'
import { csrfHeaders } from '../auth/csrf'
import AssistantBookingForm from '../components/AssistantBookingForm'
import RankingStars from '../components/RankingStars'
import { euros, formatDate } from '../components/assistantFormatting'
import type { AssistantService, AssistantSlot } from '../components/AssistantBookingForm'
import '../css/public-assistant.css'

type MapPoint = { latitude: number; longitude: number; exact: boolean }
type GalleryPhoto = { id: number; photoUrl: string; caption: string }
type PublicProfile = {
  id: number
  name: string
  photoUrl: string
  city: string
  distanceKm: number | null
  mapPoint: MapPoint | null
  rankingScore: number
  experienceYears: number
  roles: string[]
  headline: string
  bio: string
  typicalDay: string
  safetyAndHome: string
  ownerInstructions: string
  petSize: string
  breeds: string[]
  petTypes: string[]
  houseFeatures: string[]
  gallery: GalleryPhoto[]
  services: AssistantService[]
  confirmationMode: string
  responses: { rate: number | null; medianSeconds: number | null }
  reviews: {
    positive: number
    negative: number
    comments: { id: number; sentiment: string; text: string; date: number; service: string }[]
  }
  favorite: boolean
  viewerRole: string
  pets: { id: number; name: string }[]
  policies: { maxBookingDurationMinutes: number; bookingMinNoticeHours: number; ownerFreeCancellationHours: number }
}

const petSizes: Record<string, string> = {
  small: 'Piccola (0–7 kg)', medium: 'Media (7–18 kg)', large: 'Grande (18–45 kg)', max: 'Max (oltre 45 kg)',
}

function todayInRome(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format()
}

function addDays(value: string, days: number): string {
  const date = new Date(value + 'T12:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function isDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && addDays(value, 0) === value)
}

function initialRange() {
  const params = new URLSearchParams(window.location.search)
  const today = todayInRome()
  const requestedFrom = params.get('from')
  const requestedTo = params.get('to')
  const from = isDate(requestedFrom) && requestedFrom >= today ? requestedFrom : today
  return { from, to: isDate(requestedTo) && requestedTo >= from && requestedTo <= addDays(from, 62) ? requestedTo : addDays(from, 14) }
}

async function getData<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  const payload = await response.json()
  if (!response.ok || !payload.ok) throw new Error(payload.message || 'Dati momentaneamente non disponibili.')
  return payload.data as T
}

function responseLabel(seconds: number): string {
  if (seconds < 15 * 60) return 'Di solito risponde in pochi minuti'
  if (seconds < 60 * 60) return 'Di solito risponde entro un’ora'
  const hours = Math.round(seconds / 360) / 10
  return `Di solito risponde in circa ${hours.toLocaleString('it-IT')} ${hours === 1 ? 'ora' : 'ore'}`
}

function ProfileMap({ point, city }: { point: MapPoint; city: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const coordinates: L.LatLngTuple = [point.latitude, point.longitude]
    const map = L.map(ref.current, { center: coordinates, zoom: point.exact ? 15 : 13, scrollWheelZoom: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)
    if (point.exact) {
      L.circleMarker(coordinates, { radius: 9, color: '#fff', weight: 3, fillColor: '#2f7a4a', fillOpacity: 1 }).addTo(map)
    } else {
      L.circle(coordinates, { radius: 1000, color: '#2f7a4a', weight: 2, fillOpacity: 0.2 }).addTo(map)
    }
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(ref.current)
    return () => {
      observer.disconnect()
      map.remove()
    }
  }, [point])

  return <div ref={ref} className="public-map" role="region" aria-label={`Mappa ${point.exact ? 'della posizione' : 'della zona'} ${city}`} />
}

function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const dialog = useRef<HTMLDialogElement>(null)
  return (
    <section className="public-panel" aria-labelledby="public-gallery-title">
      <div className="public-section-heading">
        <h2 id="public-gallery-title">Galleria</h2>
        <button type="button" className="public-link-button" onClick={() => dialog.current?.showModal()}>Tutte le foto ({photos.length})</button>
      </div>
      <div className="public-gallery">
        {photos.slice(0, 3).map((photo, index) => (
          <button type="button" key={photo.id} onClick={() => {
            dialog.current?.showModal()
            dialog.current?.querySelector(`[data-photo-id="${photo.id}"]`)?.scrollIntoView({ block: 'nearest' })
          }}>
            <img src={photo.photoUrl} alt={photo.caption || `Foto ${index + 1} dell’ambiente`} loading="lazy" />
          </button>
        ))}
      </div>
      <dialog ref={dialog} className="public-gallery-dialog" aria-label="Tutte le foto" onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close()
      }}>
        <div className="public-gallery-dialog-content">
          <div className="public-section-heading"><h2>Galleria</h2><button className="public-link-button" onClick={() => dialog.current?.close()}>Chiudi</button></div>
          {photos.map((photo, index) => <figure key={photo.id} data-photo-id={photo.id}>
            <img src={photo.photoUrl} alt={photo.caption || `Foto ${index + 1} dell’ambiente`} loading="lazy" />
            {photo.caption && <figcaption>{photo.caption}</figcaption>}
          </figure>)}
        </div>
      </dialog>
    </section>
  )
}

function AvailabilityCalendar({ from, to, dates, selected, onSelect }: {
  from: string; to: string; dates: Set<string>; selected: string; onSelect: (date: string) => void
}) {
  const [currentMonth, setCurrentMonth] = useState(from.slice(0, 7))
  const firstMonth = from.slice(0, 7)
  const lastMonth = to.slice(0, 7)
  const month = currentMonth >= firstMonth && currentMonth <= lastMonth ? currentMonth : firstMonth
  const date = new Date(month + '-01T12:00:00Z')
  const year = date.getUTCFullYear()
  const monthIndex = date.getUTCMonth()
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const offset = (date.getUTCDay() + 6) % 7
  const title = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)

  function navigate(direction: number) {
    setCurrentMonth(new Date(Date.UTC(year, monthIndex + direction, 1)).toISOString().slice(0, 7))
  }

  return <div className="public-calendar">
    <div className="public-section-heading">
      <button type="button" className="public-link-button" onClick={() => navigate(-1)} disabled={month <= firstMonth} aria-label="Mese precedente">‹</button>
      <strong>{title}</strong>
      <button type="button" className="public-link-button" onClick={() => navigate(1)} disabled={month >= lastMonth} aria-label="Mese successivo">›</button>
    </div>
    <div className="public-calendar-grid">
      {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((label) => <span key={label}>{label}</span>)}
      {Array.from({ length: offset }, (_, index) => <span aria-hidden="true" key={`blank-${index}`} />)}
      {Array.from({ length: days }, (_, index) => {
        const day = index + 1
        const value = `${month}-${String(day).padStart(2, '0')}`
        return <button type="button" key={value} disabled={!dates.has(value)} aria-label={formatDate(value)}
          aria-pressed={selected === value} onClick={() => onSelect(value)}>{day}</button>
      })}
    </div>
  </div>
}

export default function PublicPetAssistantPage() {
  const assistantId = Number(window.location.pathname.split('/').filter(Boolean).at(-1))
  const fromSearch = new URLSearchParams(window.location.search).has('services')
  const loginHref = `/?login=1&returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [profileError, setProfileError] = useState('')
  const [range, setRange] = useState(initialRange)
  const [calendarDay, setCalendarDay] = useState({ date: '', version: 0 })
  const [revision, setRevision] = useState(0)
  const [availability, setAvailability] = useState<{ key: string; slots: AssistantSlot[]; error?: string } | null>(null)
  const [favoriteBusy, setFavoriteBusy] = useState(false)
  const [favoriteNotice, setFavoriteNotice] = useState('')
  const profileLoaded = profile !== null
  const rangeKey = `${range.from}:${range.to}:${revision}`
  const validRange = isDate(range.from) && isDate(range.to) && range.from <= range.to && range.to <= addDays(range.from, 62)
  const slots = validRange && availability?.key === rangeKey ? availability.slots : []
  const loadingSlots = validRange && availability?.key !== rangeKey
  const dateSet = new Set(slots.map((slot) => slot.date))

  useEffect(() => {
    const abort = new AbortController()
    void getData<PublicProfile>(`/api/pet-assistants/${assistantId}`, abort.signal).then((data) => {
      setProfile(data)
      document.title = `${data.name} | Coccole Bestiali`
    }).catch((error: Error) => {
      if (!abort.signal.aborted) setProfileError(error.message)
    })
    return () => abort.abort()
  }, [assistantId])

  useEffect(() => {
    if (!profileLoaded || !validRange) return
    const abort = new AbortController()
    const params = new URLSearchParams(range)
    void getData<AssistantSlot[]>(`/api/pet-assistants/${assistantId}/availability?${params}`, abort.signal)
      .then((data) => setAvailability({ key: rangeKey, slots: data }))
      .catch((error: Error) => {
        if (!abort.signal.aborted) setAvailability({ key: rangeKey, slots: [], error: error.message })
      })
    return () => abort.abort()
  }, [assistantId, profileLoaded, range, rangeKey, validRange])

  function selectDay(date: string) {
    setCalendarDay((current) => ({ date, version: current.version + 1 }))
    document.getElementById('prenota')?.focus({ preventScroll: true })
    document.getElementById('prenota')?.scrollIntoView({ block: 'start' })
  }

  async function toggleFavorite() {
    if (!profile || favoriteBusy) return
    setFavoriteBusy(true)
    setFavoriteNotice('')
    try {
      const response = await fetch(`/api/pet-assistants/${assistantId}/favorite`, {
        method: 'PUT',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ favorite: !profile.favorite }),
      })
      if (response.status === 401) {
        window.location.assign(loginHref)
        return
      }
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.message || 'Preferito non aggiornato.')
      setProfile((current) => current ? { ...current, favorite: result.data.favorite } : current)
      setFavoriteNotice(result.data.favorite ? 'Aggiunto ai preferiti.' : 'Rimosso dai preferiti.')
    } catch (error) {
      setFavoriteNotice(error instanceof Error ? error.message : 'Preferito non aggiornato.')
    } finally {
      setFavoriteBusy(false)
    }
  }

  return <main className="search-shell public-assistant">
    <div className="search-stage public-stage">
      <header className="search-topbar public-navigation">
        <a className="search-brand" href="/" aria-label="Coccole Bestiali, home"><img src={logo} alt="" /></a>
        <a className="search-home-link" href={fromSearch ? '/search?restore=1' : '/search'}>Torna ai risultati</a>
      </header>
      {!profile ? <section className="public-panel" role={profileError ? 'alert' : 'status'}>{profileError || 'Caricamento del profilo…'}</section> : <>
        <section className="public-hero public-panel">
          <div className="public-avatar">{profile.photoUrl ? <img src={profile.photoUrl} alt="" /> : profile.name.charAt(0).toUpperCase()}</div>
          <div className="public-identity">
            <p className="public-kicker">PET ASSISTANT</p>
            <h1>{profile.name}</h1>
            <p className="public-location">{profile.city || 'Località non indicata'}{profile.distanceKm !== null ? ` · ${profile.distanceKm.toLocaleString('it-IT')} km` : ''}</p>
            <div className="public-identity-meta">
              <RankingStars score={profile.rankingScore} />
              {profile.roles.map((role) => <span key={role}>{role}</span>)}
              {profile.experienceYears > 0 && <span>{profile.experienceYears} {profile.experienceYears === 1 ? 'anno' : 'anni'} di esperienza</span>}
            </div>
          </div>
          <div className="public-favorite">
            {profile.viewerRole === 'pet_owner' ? <button type="button" className="public-link-button" aria-pressed={profile.favorite} disabled={favoriteBusy} onClick={() => void toggleFavorite()}><span aria-hidden="true">{profile.favorite ? '♥' : '♡'}</span> Preferito</button>
              : !profile.viewerRole ? <a className="public-link-button" href={loginHref}><span aria-hidden="true">♡</span> Preferito</a> : null}
            {favoriteNotice && <p role="status">{favoriteNotice}</p>}
          </div>
        </section>
        <div className="public-layout">
          <div className="public-main-column">
            {profile.gallery.length > 0 && <PhotoGallery photos={profile.gallery} />}
            <section className="public-panel">
              <h2>{profile.headline || 'Presentazione'}</h2>
              {profile.bio ? <p className="public-prose">{profile.bio}</p> : <p>Presentazione non ancora disponibile.</p>}
              {profile.responses.rate !== null && <div className="public-response">
                <p><strong>{profile.responses.rate}%</strong> tasso di risposta <small>· ultimi 90 giorni</small></p>
                {profile.responses.medianSeconds !== null && <p>{responseLabel(profile.responses.medianSeconds)}</p>}
              </div>}
            </section>
            <section className="public-panel" aria-labelledby="public-availability">
              <h2 id="public-availability">Calendario e disponibilità</h2>
              <div className="public-date-range">
                <label className="public-field">Dal<input type="date" min={todayInRome()} value={range.from} onChange={(event) => {
                  const from = event.target.value
                  setRange({ from, to: range.to < from ? from : range.to })
                  setCalendarDay((current) => ({ ...current, date: '' }))
                }} /></label>
                <label className="public-field">Al<input type="date" min={range.from} max={isDate(range.from) ? addDays(range.from, 62) : undefined} value={range.to} onChange={(event) => {
                  setRange({ ...range, to: event.target.value })
                  setCalendarDay((current) => ({ ...current, date: '' }))
                }} /></label>
              </div>
              {!validRange ? <p role="alert">Seleziona un intervallo valido di massimo 62 giorni.</p> : <>
                {loadingSlots && <p role="status">Caricamento disponibilità…</p>}
                {availability?.key === rangeKey && availability.error ? <p role="alert">{availability.error} <button type="button" className="public-link-button" onClick={() => setRevision((current) => current + 1)}>Riprova</button></p>
                  : !loadingSlots && !slots.length ? <p>Nessuna fascia disponibile in queste date.</p> : null}
                <AvailabilityCalendar from={range.from} to={range.to} dates={dateSet} selected={calendarDay.date} onSelect={selectDay} />
              </>}
              {profile.typicalDay && <><h3>Una giornata tipo</h3><p className="public-prose">{profile.typicalDay}</p></>}
            </section>
            <section className="public-panel">
              <h2>Posizione</h2>
              {profile.mapPoint ? <><p className="public-muted">{profile.mapPoint.exact ? 'Punto indicato dal Pet Assistant.' : 'La mappa mostra la zona approssimativa.'}</p><ProfileMap point={profile.mapPoint} city={profile.city} /></>
                : <p>Posizione non indicata.</p>}
            </section>
            {(profile.houseFeatures.length > 0 || profile.safetyAndHome) && <section className="public-panel">
              <h2>Ambiente domestico e sicurezza</h2>
              {profile.houseFeatures.length > 0 && <ul className="public-tags">{profile.houseFeatures.map((item) => <li key={item}>{item}</li>)}</ul>}
              {profile.safetyAndHome && <p className="public-prose">{profile.safetyAndHome}</p>}
            </section>}
            <section className="public-panel">
              <h2>Pet accettati</h2>
              {profile.petSize && <p><strong>Taglia</strong> · {petSizes[profile.petSize] ?? profile.petSize}</p>}
              {profile.breeds.length > 0 && <p><strong>Razze</strong> · {profile.breeds.join(', ')}</p>}
              {profile.petTypes.length > 0 && <p><strong>Caratteristiche</strong> · {profile.petTypes.join(', ')}</p>}
              {!profile.petSize && !profile.breeds.length && !profile.petTypes.length && <p>Caratteristiche non ancora indicate.</p>}
              {profile.ownerInstructions && <><h3>Cosa vorrebbe sapere sul tuo pet</h3><p className="public-prose">{profile.ownerInstructions}</p></>}
            </section>
            <section className="public-panel">
              <h2>Recensioni</h2>
              {profile.reviews.positive + profile.reviews.negative === 0 ? <p>Nessuna recensione ricevuta.</p>
                : <p><strong>{profile.reviews.positive}</strong> positive · <strong>{profile.reviews.negative}</strong> negative</p>}
              {profile.reviews.comments.map((review) => <article className="public-review" key={review.id}>
                <p><strong>{review.sentiment === 'positive' ? 'Positiva' : 'Negativa'}</strong> · {review.service} · {new Date(review.date * 1000).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' })}</p>
                <p className="public-prose">{review.text}</p>
              </article>)}
            </section>
            {profile.services.length > 0 && <section className="public-panel">
              <h2>Servizi e tariffe</h2>
              <ul className="public-service-list">{profile.services.map((service) => <li key={service.id}>
                <strong>{service.name}</strong><span>{euros(Math.round(service.hourlyRate * 100))}/ora</span>
                {service.description && <p>{service.description}</p>}
                {service.features.length > 0 && <small>{service.features.map((feature) => feature.name).join(' · ')}</small>}
              </li>)}</ul>
            </section>}
          </div>
          <AssistantBookingForm assistantId={profile.id} services={profile.services} slots={slots} pets={profile.pets}
            viewerRole={profile.viewerRole} confirmationMode={profile.confirmationMode} maxDuration={profile.policies.maxBookingDurationMinutes}
            minNotice={profile.policies.bookingMinNoticeHours} cancelHours={profile.policies.ownerFreeCancellationHours}
            calendarDay={calendarDay} availableDates={dateSet}
            loadingSlots={loadingSlots} loginHref={loginHref} onRefresh={() => setRevision((current) => current + 1)} />
        </div>
      </>}
      <PublicFooter />
    </div>
    {Boolean(profile?.services.length) && <div className="public-mobile-booking"><a href="#prenota" className="public-primary">Vai alla prenotazione</a></div>}
  </main>
}
