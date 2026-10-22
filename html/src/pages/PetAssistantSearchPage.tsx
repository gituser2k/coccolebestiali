import { useEffect, useMemo, useState } from 'react'
import logoImage from '../assets/logo.png'
import '../css/search.css'
import '../css/combobox.css'

type ServiceOption = {
  id: number
  name: string
  description: string
}

type PetOption = {
  id: number
  name: string
  petSize: string
  photoUrl: string
}

type SearchOptions = {
  services: ServiceOption[]
  pets: PetOption[]
  authenticatedRole: string
  policies: PortalPolicies
}

type PortalPolicies = {
  bookingMinNoticeHours: number
  manualResponseHours: number
  assistantCutoffHours: number
  ownerFreeCancellationHours: number
  ownerLateCancellationPenalty: number
  assistantLateActionPenalty: number
  positiveReviewPoints: number
  negativeReviewPenalty: number
  initialReputationScore: number
  reviewWindowDays: number
  maxBookingDurationMinutes: number
}

type AvailabilitySlot = {
  slotId: number
  date: string
  startTime: string
  endTime: string
  hourlyRate: number
  confirmationMode: 'manual' | 'automatic'
}

type MatchedService = {
  id: number
  name: string
  description: string
  requiresHomePhoto: boolean
  hourlyRate: number
  totalCost: number
  availableDays: number
  slots: AvailabilitySlot[]
}

type OtherService = {
  id: number
  name: string
  hourlyRate: number
  features: string[]
}

type HouseGalleryPhoto = {
  id: number
  photoUrl: string
  caption: string
  sortorder: number
}

type AssistantResult = {
  id: number
  name: string
  alias: string
  photoUrl: string
  city: string
  bio: string
  experienceYears: number
  rankingScore: number
  stars: number
  distanceKm: number | null
  minimumTotalCost: number
  titles: string[]
  houseGallery: HouseGalleryPhoto[]
  petMatch: string
  matchedServices: MatchedService[]
  otherServices: OtherService[]
  availableDays: number
  firstAvailableDate: string
}

type BookingSelection = {
  assistant: AssistantResult
  service: MatchedService
  slot: AvailabilitySlot
}

type HouseGallerySelection = {
  assistantName: string
  photos: HouseGalleryPhoto[]
}

type SearchResponse = {
  results: AssistantResult[]
  total: number
  pet: { id: number; name: string; petSize: string } | null
}

const EMPTY_OPTIONS: SearchOptions = {
  services: [],
  pets: [],
  authenticatedRole: '',
  policies: {
    bookingMinNoticeHours: 24,
    manualResponseHours: 24,
    assistantCutoffHours: 3,
    ownerFreeCancellationHours: 24,
    ownerLateCancellationPenalty: 5,
    assistantLateActionPenalty: 5,
    positiveReviewPoints: 5,
    negativeReviewPenalty: 5,
    initialReputationScore: 60,
    reviewWindowDays: 30,
    maxBookingDurationMinutes: 480,
  },
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatDate(value: string): string {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`))
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDuration(minutes: number): string {
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number)
  return (hours * 60) + minutes
}

function minutesToTime(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

function buildTimeOptions(start: string, end: string): string[] {
  const options: string[] = []
  for (let value = timeToMinutes(start); value <= timeToMinutes(end); value += 30) {
    options.push(minutesToTime(value))
  }
  return options
}

function RankingStars({ score, stars }: { score: number; stars: number }) {
  return (
    <span className="assistant-ranking" aria-label={`Ranking ${score} su 100, equivalente a ${stars} stelle su 5`}>
      <span className="assistant-stars" aria-hidden="true">
        <span>★★★★★</span>
        <span className="assistant-stars-fill" style={{ width: `${Math.max(0, Math.min(100, (stars / 5) * 100))}%` }}>★★★★★</span>
      </span>
      <strong>{score}/100</strong>
    </span>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.8" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function PetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 11.2c-3.5 0-6.4 2.7-6.4 5.7 0 2.2 1.7 3.6 4 3.1 1.6-.3 3.2-.3 4.8 0 2.3.5 4-1 4-3.1 0-3-2.9-5.7-6.4-5.7Z" fill="currentColor" />
      <ellipse cx="5.3" cy="9" rx="2.1" ry="2.8" transform="rotate(-28 5.3 9)" fill="currentColor" />
      <ellipse cx="18.7" cy="9" rx="2.1" ry="2.8" transform="rotate(28 18.7 9)" fill="currentColor" />
      <ellipse cx="9.2" cy="5.8" rx="2.1" ry="2.8" transform="rotate(-8 9.2 5.8)" fill="currentColor" />
      <ellipse cx="14.8" cy="5.8" rx="2.1" ry="2.8" transform="rotate(8 14.8 5.8)" fill="currentColor" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function HomePhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 10.5 12 3.8l8.5 6.7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 9.5v10h13v-10M9 19.5v-6h6v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16.8" cy="8.2" r="2.2" fill="currentColor" />
    </svg>
  )
}

export default function PetAssistantSearchPage() {
  const today = useMemo(() => new Date(), [])
  const [startDate, setStartDate] = useState(toIsoDate(today))
  const [endDate, setEndDate] = useState(toIsoDate(addDays(today, 14)))
  const [options, setOptions] = useState<SearchOptions>(EMPTY_OPTIONS)
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([])
  const [useMyPet, setUseMyPet] = useState(false)
  const [selectedPetId, setSelectedPetId] = useState(0)
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [sortBy, setSortBy] = useState<'ranking' | 'distance' | 'cost'>('ranking')
  const [onlyWithPhoto, setOnlyWithPhoto] = useState(false)
  const [results, setResults] = useState<AssistantResult[]>([])
  const [visibleResultCount, setVisibleResultCount] = useState(8)
  const [matchedPetName, setMatchedPetName] = useState('')
  const [searchedPetId, setSearchedPetId] = useState(0)
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [toast, setToast] = useState<{ message: string; tone: 'error' | 'success' } | null>(null)
  const [bookingSelection, setBookingSelection] = useState<BookingSelection | null>(null)
  const [houseGallerySelection, setHouseGallerySelection] = useState<HouseGallerySelection | null>(null)
  const [bookingStartTime, setBookingStartTime] = useState('')
  const [bookingEndTime, setBookingEndTime] = useState('')
  const [bookingMessage, setBookingMessage] = useState('')
  const [isBooking, setIsBooking] = useState(false)
  const [createdBookingNumber, setCreatedBookingNumber] = useState('')
  const bookingTotal = bookingSelection
    ? bookingSelection.slot.hourlyRate * Math.max(0, timeToMinutes(bookingEndTime) - timeToMinutes(bookingStartTime)) / 60
    : 0

  useEffect(() => {
    void loadOptions()
  }, [])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timer = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!houseGallerySelection) {
      return
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setHouseGallerySelection(null)
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [houseGallerySelection])

  async function loadOptions() {
    setIsLoadingOptions(true)
    try {
      const response = await fetch('/api/search/pet-assistants/options', {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      })
      const payload = await response.json()
      if (!response.ok || !payload?.ok) {
        throw new Error('OPTIONS_NOT_AVAILABLE')
      }

      const nextOptions = payload.data as SearchOptions
      const initialServiceIds = nextOptions.services.map((service) => service.id)
      setOptions(nextOptions)
      setSelectedServiceIds(initialServiceIds)
      if (nextOptions.pets.length > 0) {
        setSelectedPetId(nextOptions.pets[0].id)
      }
    } catch {
      setToast({ message: 'Ricerca momentaneamente non disponibile.', tone: 'error' })
    } finally {
      setIsLoadingOptions(false)
    }
  }

  async function executeSearch(serviceIds: number[], petId: number, from: string, to: string) {
    if (!from || !to) {
      setToast({ message: 'Indica la data di inizio e la data di fine.', tone: 'error' })
      return
    }
    if (to < from) {
      setToast({ message: 'La data di fine deve essere successiva alla data di inizio.', tone: 'error' })
      return
    }
    if (serviceIds.length === 0) {
      setToast({ message: 'Seleziona almeno un servizio.', tone: 'error' })
      return
    }
    if (useMyPet && petId <= 0) {
      setToast({ message: 'Seleziona il pet per cui effettuare la ricerca.', tone: 'error' })
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch('/api/search/pet-assistants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          startDate: from,
          endDate: to,
          serviceIds,
          petId: useMyPet ? petId : null,
          durationMinutes,
          sortBy,
          onlyWithPhoto,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Ricerca non completata.')
      }

      const data = payload.data as SearchResponse
      setResults(data.results)
      setVisibleResultCount(8)
      setMatchedPetName(data.pet?.name ?? '')
      setSearchedPetId(useMyPet ? petId : 0)
      setHasSearched(true)
    } catch (error) {
      setResults([])
      setVisibleResultCount(8)
      setSearchedPetId(0)
      setHasSearched(true)
      setToast({
        message: error instanceof Error ? error.message : 'Ricerca non completata.',
        tone: 'error',
      })
    } finally {
      setIsSearching(false)
    }
  }

  function toggleService(serviceId: number) {
    setSelectedServiceIds((current) =>
      current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId]
    )
  }

  function openBooking(assistant: AssistantResult, service: MatchedService, slot: AvailabilitySlot) {
    if (options.authenticatedRole !== 'pet_owner') {
      setToast({ message: 'Accedi come Pet Owner per prenotare.', tone: 'error' })
      return
    }
    if (options.pets.length === 0) {
      setToast({ message: 'Inserisci prima un pet nel tuo profilo.', tone: 'error' })
      return
    }
    if (!useMyPet || selectedPetId <= 0 || searchedPetId !== selectedPetId) {
      setToast({
        message: 'Per prenotare, seleziona il tuo pet e avvia nuovamente la ricerca.',
        tone: 'error',
      })
      return
    }
    const start = slot.startTime
    const end = minutesToTime(Math.min(timeToMinutes(slot.endTime), timeToMinutes(start) + durationMinutes))
    setBookingSelection({ assistant, service, slot })
    setBookingStartTime(start)
    setBookingEndTime(end)
    setBookingMessage('')
    setCreatedBookingNumber('')
  }

  async function confirmBooking() {
    if (!bookingSelection || !useMyPet || selectedPetId <= 0 || searchedPetId !== selectedPetId) {
      setToast({ message: 'Seleziona il pet per cui prenotare.', tone: 'error' })
      return
    }
    if (timeToMinutes(bookingEndTime) <= timeToMinutes(bookingStartTime)) {
      setToast({ message: 'Seleziona un intervallo valido.', tone: 'error' })
      return
    }
    setIsBooking(true)
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          assistantUserId: bookingSelection.assistant.id,
          petId: selectedPetId,
          serviceId: bookingSelection.service.id,
          slotId: bookingSelection.slot.slotId,
          date: bookingSelection.slot.date,
          startTime: bookingStartTime,
          endTime: bookingEndTime,
          message: bookingMessage,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || 'Prenotazione non completata.')
      setCreatedBookingNumber(payload.data.bookingNumber)
      setToast({
        message: payload.data.notificationWarning
          ? 'Prenotazione registrata. Invio email non completato.'
          : payload.data.status === 'confirmed' ? 'Prenotazione confermata.' : 'Richiesta di prenotazione inviata.',
        tone: payload.data.notificationWarning ? 'error' : 'success',
      })
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Prenotazione non completata.', tone: 'error' })
    } finally {
      setIsBooking(false)
    }
  }

  function togglePetSearch() {
    if (!useMyPet && options.pets.length === 0) {
      const message = options.authenticatedRole === 'pet_owner'
        ? 'Inserisci prima un pet nel tuo profilo.'
        : 'Accedi come Pet Owner per cercare in base al tuo pet.'
      setToast({ message, tone: 'error' })
      return
    }

    setUseMyPet((current) => !current)
  }

  return (
    <main className="search-shell">
      <section className="search-stage">
        <header className="search-topbar">
          <a className="search-brand" href="/" aria-label="Torna alla home">
            <img src={logoImage} alt="Coccole Bestiali" />
          </a>
          <div className="search-heading">
            <span>RICERCA PET ASSISTANT</span>
            <h1>La persona giusta, nel momento giusto.</h1>
          </div>
          <a className="search-home-link" href="/">Torna alla Home</a>
        </header>

        <section className="search-filter-panel" aria-label="Filtri di ricerca">
          <div className="search-date-grid">
            <label className="search-field">
              <span><CalendarIcon /> Data inizio</span>
              <input
                type="date"
                min={toIsoDate(today)}
                value={startDate}
                onChange={(event) => {
                  const value = event.target.value
                  setStartDate(value)
                  if (endDate < value) {
                    setEndDate(value)
                  }
                }}
              />
            </label>
            <label className="search-field">
              <span><CalendarIcon /> Data fine</span>
              <input
                type="date"
                min={startDate}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
            <div className="search-pet-control">
              <button
                className={`search-pet-toggle${useMyPet ? ' is-active' : ''}`}
                type="button"
                onClick={togglePetSearch}
                aria-pressed={useMyPet}
              >
                <PetIcon />
                Ricerca per il mio Pet
              </button>
              {useMyPet ? (
                <label className="search-pet-select">
                  <span>Seleziona il pet</span>
                  <select className="portal-combobox" value={selectedPetId} onChange={(event) => setSelectedPetId(Number(event.target.value))}>
                    {options.pets.map((pet) => (
                      <option key={pet.id} value={pet.id}>{pet.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          </div>

          <fieldset className="search-services-fieldset" aria-label="Servizi richiesti" disabled={isLoadingOptions}>
            <p>Puoi selezionare uno o più servizi.</p>
            <div className="search-service-options">
              {options.services.map((service) => {
                const selected = selectedServiceIds.includes(service.id)
                return (
                  <label className={`search-service-option${selected ? ' is-selected' : ''}`} key={service.id}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleService(service.id)}
                    />
                    <span className="search-service-check" aria-hidden="true">✓</span>
                    <span>{service.name}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div className="search-submit-row">
            <div className="search-order-controls">
              <label>
                <span>Durata</span>
                <select className="portal-combobox" value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}>
                  {Array.from({ length: Math.max(1, Math.floor(options.policies.maxBookingDurationMinutes / 30)) }, (_, index) => (index + 1) * 30).map((minutes) => (
                    <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Ordina per</span>
                <select className="portal-combobox" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
                  <option value="ranking">Miglior ranking</option>
                  <option value="distance">Più vicino</option>
                  <option value="cost">Costo minore</option>
                </select>
              </label>
              <label className="search-photo-filter">
                <input
                  type="checkbox"
                  checked={onlyWithPhoto}
                  onChange={(event) => setOnlyWithPhoto(event.target.checked)}
                />
                <span className="search-photo-filter-check" aria-hidden="true">✓</span>
                <span>Solo con Foto</span>
              </label>
            </div>
            <button
              className="search-submit"
              type="button"
              disabled={isSearching || isLoadingOptions}
              onClick={() => void executeSearch(selectedServiceIds, selectedPetId, startDate, endDate)}
            >
              <SearchIcon />
              {isSearching ? 'Ricerca in corso...' : 'Cerca Pet Assistant'}
            </button>
          </div>
        </section>

        <section className="search-results" aria-live="polite" aria-busy={isSearching}>
          <div className="search-results-heading">
            <div>
              <span>{hasSearched ? 'RISULTATI' : 'INIZIA DA QUI'}</span>
              <h2>
                {hasSearched
                  ? `${results.length} Pet Assistant disponibili`
                  : 'Imposta i parametri di ricerca'}
              </h2>
            </div>
            {matchedPetName ? <strong>Compatibilità verificata per {matchedPetName}</strong> : null}
          </div>

          {!hasSearched && !isSearching ? (
            <div className="search-empty-state search-initial-state">
              <SearchIcon />
              <h3>Trova il Pet Assistant più adatto</h3>
              <p>Seleziona le date, uno o più servizi e, se vuoi, il tuo pet. Poi avvia la ricerca.</p>
            </div>
          ) : null}

          {hasSearched && !isSearching && results.length === 0 ? (
            <div className="search-empty-state">
              <PetIcon />
              <h3>Nessun Pet Assistant disponibile</h3>
              <p>Prova ad ampliare l’intervallo di date oppure seleziona altri servizi.</p>
            </div>
          ) : null}

          <div className="assistant-results-list">
            {results.slice(0, visibleResultCount).map((assistant) => (
              <article className="assistant-card" key={assistant.id}>
                <div className="assistant-identity">
                  <div className="assistant-photo-wrap">
                    {assistant.photoUrl ? (
                      <img src={assistant.photoUrl} alt={`Foto di ${assistant.name}`} />
                    ) : (
                      <span>{assistant.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="assistant-name-block">
                    <div className="assistant-name-row">
                      <h3>{assistant.name}</h3>
                      {assistant.petMatch ? <span className="assistant-match-badge">{assistant.petMatch}</span> : null}
                    </div>
                    <p className="assistant-meta">
                      {assistant.city || 'Città non indicata'}
                      <span aria-hidden="true">•</span>
                      {assistant.experienceYears > 0
                        ? `${assistant.experienceYears} ${assistant.experienceYears === 1 ? 'anno' : 'anni'} di esperienza`
                        : 'Nuovo professionista'}
                    </p>
                    <div className="assistant-ranking-row">
                      <RankingStars score={assistant.rankingScore} stars={assistant.stars} />
                      <span>{assistant.distanceKm === null ? 'Distanza non disponibile' : `${assistant.distanceKm.toLocaleString('it-IT')} km`}</span>
                    </div>
                    {assistant.titles.length > 0 ? (
                      <div className="assistant-title-list">
                        {assistant.titles.map((title) => <span key={title}>{title}</span>)}
                      </div>
                    ) : null}
                    {assistant.bio ? <p className="assistant-bio">{assistant.bio}</p> : null}
                  </div>
                </div>

                <div className="assistant-service-area">
                  <div className="assistant-service-heading">
                    <span>SERVIZI TROVATI</span>
                    <strong>{assistant.availableDays} {assistant.availableDays === 1 ? 'giorno disponibile' : 'giorni disponibili'}</strong>
                  </div>
                  <div className="assistant-matched-services">
                    {assistant.matchedServices.map((service) => (
                      <section className={`assistant-service-card${service.requiresHomePhoto ? ' has-home-photo' : ''}`} key={service.id}>
                        <div className="assistant-service-title">
                          <div>
                            <h4>{service.name}</h4>
                            <p>{service.description}</p>
                          </div>
                          <div className="assistant-service-price">
                            {service.hourlyRate > 0 ? (
                              <strong>{formatPrice(service.totalCost)}<small>{formatDuration(durationMinutes)} · {formatPrice(service.hourlyRate)}/ora</small></strong>
                            ) : null}
                            {service.requiresHomePhoto ? (
                              <button
                                type="button"
                                className="assistant-home-photo"
                                title="Visualizza le foto dell'abitazione"
                                aria-haspopup="dialog"
                                onClick={() => setHouseGallerySelection({
                                  assistantName: assistant.name,
                                  photos: assistant.houseGallery,
                                })}
                              >
                                <HomePhotoIcon />
                                <small>CON FOTO</small>
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="assistant-slots">
                          {service.slots.map((slot, index) => (
                            <button type="button" key={`${slot.slotId}-${slot.date}-${slot.startTime}-${index}`} onClick={() => openBooking(assistant, service, slot)}>
                              {formatDate(slot.date)} <strong>{slot.startTime}–{slot.endTime}</strong>
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>

                  {assistant.otherServices.length > 0 ? (
                    <div className="assistant-other-services">
                      <span>Altri servizi attivi</span>
                      <div>
                        {assistant.otherServices.map((service) => (
                          <span key={service.id} title={service.features.join(', ')}>
                            {service.name}{service.hourlyRate > 0 ? ` · ${formatPrice(service.hourlyRate)}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          {visibleResultCount < results.length ? (
            <button
              className="search-load-more"
              type="button"
              onClick={() => setVisibleResultCount((current) => current + 8)}
            >
              Mostra altri Pet Assistant
              <span>{Math.min(results.length - visibleResultCount, 8)}</span>
            </button>
          ) : null}
        </section>
      </section>

      {toast ? <div className={`search-toast ${toast.tone}`}>{toast.message}</div> : null}
      {houseGallerySelection ? (
        <div className="booking-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setHouseGallerySelection(null)
        }}>
          <section className="house-gallery-modal" role="dialog" aria-modal="true" aria-labelledby="house-gallery-modal-title">
            <button className="booking-modal-close" type="button" onClick={() => setHouseGallerySelection(null)} aria-label="Chiudi">×</button>
            <span className="booking-modal-kicker">GALLERY FOTO CASA</span>
            <h2 id="house-gallery-modal-title">L'abitazione di {houseGallerySelection.assistantName}</h2>
            {houseGallerySelection.photos.length > 0 ? (
              <div className="house-gallery-list">
                {houseGallerySelection.photos.map((photo, index) => (
                  <figure className="house-gallery-item" key={photo.id}>
                    <img src={photo.photoUrl} alt={photo.caption || `Foto abitazione ${index + 1}`} />
                    {photo.caption ? <figcaption>{photo.caption}</figcaption> : null}
                  </figure>
                ))}
              </div>
            ) : (
              <p className="house-gallery-empty">Le foto dell'abitazione non sono ancora disponibili.</p>
            )}
          </section>
        </div>
      ) : null}
      {bookingSelection ? (
        <div className="booking-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isBooking) setBookingSelection(null)
        }}>
          <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-modal-title">
            <button className="booking-modal-close" type="button" onClick={() => setBookingSelection(null)} aria-label="Chiudi">×</button>
            {createdBookingNumber ? (
              <div className="booking-success">
                <span>PRENOTAZIONE REGISTRATA</span>
                <h2 id="booking-modal-title">{createdBookingNumber}</h2>
                <p>{bookingSelection.slot.confirmationMode === 'automatic' ? 'La prenotazione è già confermata.' : 'La richiesta è stata inviata al Pet Assistant.'}</p>
                <button type="button" onClick={() => setBookingSelection(null)}>Chiudi</button>
              </div>
            ) : (
              <>
                <span className="booking-modal-kicker">CONFERMA PRENOTAZIONE</span>
                <h2 id="booking-modal-title">{bookingSelection.service.name} con {bookingSelection.assistant.name}</h2>
                <div className="booking-summary-grid">
                  <div><span>Data</span><strong>{formatDate(bookingSelection.slot.date)}</strong></div>
                  <div><span>Tariffa</span><strong>{formatPrice(bookingSelection.slot.hourlyRate)}/ora</strong></div>
                  <div><span>Modalità</span><strong>{bookingSelection.slot.confirmationMode === 'automatic' ? 'Conferma automatica' : 'Richiede accettazione'}</strong></div>
                </div>
                <div className="booking-time-grid">
                  <label><span>Inizio</span><select className="portal-combobox" value={bookingStartTime} onChange={(event) => {
                    const nextStart = event.target.value
                    setBookingStartTime(nextStart)
                    if (timeToMinutes(bookingEndTime) <= timeToMinutes(nextStart)) setBookingEndTime(minutesToTime(timeToMinutes(nextStart) + 30))
                  }}>{buildTimeOptions(bookingSelection.slot.startTime, minutesToTime(timeToMinutes(bookingSelection.slot.endTime) - 30)).map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label><span>Fine</span><select className="portal-combobox" value={bookingEndTime} onChange={(event) => setBookingEndTime(event.target.value)}>{buildTimeOptions(minutesToTime(timeToMinutes(bookingStartTime) + 30), bookingSelection.slot.endTime).map((value) => <option key={value}>{value}</option>)}</select></label>
                  <div className="booking-time-total"><span>Totale</span><strong>{formatPrice(bookingTotal)}</strong></div>
                </div>
                <label className="booking-message"><span>Messaggio per il Pet Assistant</span><textarea value={bookingMessage} onChange={(event) => setBookingMessage(event.target.value)} maxLength={4096} placeholder="Aggiungi esigenze, abitudini o informazioni utili." /></label>
                <p className="booking-policy">Prenotazione possibile con almeno {options.policies.bookingMinNoticeHours} ore di anticipo. {bookingSelection.slot.confirmationMode === 'manual' ? `Il Pet Assistant dovrà rispondere entro ${options.policies.manualResponseHours} ore dalla richiesta e comunque almeno ${options.policies.assistantCutoffHours} ore prima del servizio. ` : 'La prenotazione sarà confermata immediatamente; il Pet Assistant potrà annullare entro la scadenza prevista. '}Puoi annullare senza penalità fino a {options.policies.ownerFreeCancellationHours} ore prima; successivamente il ranking diminuisce di {options.policies.ownerLateCancellationPenalty} punti.</p>
                <div className="booking-modal-actions"><button type="button" className="is-secondary" onClick={() => setBookingSelection(null)}>Annulla</button><button type="button" className="is-primary" onClick={() => void confirmBooking()} disabled={isBooking}>{isBooking ? 'Conferma in corso...' : 'Conferma prenotazione'}</button></div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </main>
  )
}
