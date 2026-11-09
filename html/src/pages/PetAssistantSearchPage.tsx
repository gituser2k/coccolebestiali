import PublicFooter from '../components/PublicFooter'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import logoImage from '../assets/logo.png'
import RankingStars from '../components/RankingStars'
import '../css/search.css'
import '../css/combobox.css'

type ServiceOption = {
  id: number
  name: string
  description: string
  features: FeatureOption[]
}

type FeatureOption = {
  id: number
  name: string
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
  canFilterFavorites: boolean
}

type SortMode = 'ranking' | 'distance' | 'cost' | 'cost_desc'

type SearchQuery = {
  startDate: string
  endDate: string
  serviceIds: number[]
  petId: number | null
  durationMinutes: number
  sortBy: SortMode
  onlyWithPhoto: boolean
  onlyFavorites?: boolean
  optionFilters: { serviceId: number; featureIds: number[] }[]
}

type SearchSnapshot = {
  query: SearchQuery
  columns: number
  visible: number
  scroll: number
  controls: {
    startDate: string
    endDate: string
    serviceIds: number[]
    petId: number
    useMyPet: boolean
    sortBy: SortMode
    onlyWithPhoto: boolean
    onlyFavorites?: boolean
    features: Record<number, number[]>
  }
}

const SEARCH_STATE_KEY = 'cb_search_state'

function readSearchSnapshot(): SearchSnapshot | null {
  const saved = window.history.state?.[SEARCH_STATE_KEY] as SearchSnapshot | undefined
  if (saved?.query) return saved
  if (new URLSearchParams(window.location.search).get('restore') !== '1') return null

  try {
    const stored = window.sessionStorage.getItem(SEARCH_STATE_KEY)
    return stored ? JSON.parse(stored) as SearchSnapshot : null
  } catch {
    return null
  }
}

type AssistantResult = {
  id: number
  favorite: boolean
  name: string
  photoUrl: string
  city: string
  bio: string
  experienceYears: number
  rankingScore: number
  stars: number
  distanceKm: number | null
  titles: string[]
  petMatch: string
  matchedServices: { id: number; name: string; hourlyRate: number }[]
  firstAvailableDate: string
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
  canFilterFavorites: false,
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

function FavoriteHeart() {
  return (
    <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20.2 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 0 1 6.5 6.5z" />
    </svg>
  )
}

function AssistantPhoto({ assistant }: { assistant: AssistantResult }) {
  return (
    <div className="assistant-photo-wrap" aria-hidden="true">
      {assistant.photoUrl ? (
        <img src={assistant.photoUrl} alt="" loading="lazy" />
      ) : (
        <span>{assistant.name.charAt(0).toUpperCase()}</span>
      )}
    </div>
  )
}

export default function PetAssistantSearchPage() {
  const today = useMemo(() => new Date(), [])
  const [snapshot] = useState(readSearchSnapshot)
  const restored = useRef(false)
  const pendingScroll = useRef(snapshot?.scroll ?? null)
  const [lastQuery, setLastQuery] = useState<SearchQuery | null>(null)
  const [startDate, setStartDate] = useState(snapshot?.controls.startDate ?? toIsoDate(today))
  const [endDate, setEndDate] = useState(snapshot?.controls.endDate ?? toIsoDate(addDays(today, 14)))
  const [options, setOptions] = useState<SearchOptions>(EMPTY_OPTIONS)
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>(snapshot?.controls.serviceIds ?? [])
  const [isServiceMenuOpen, setIsServiceMenuOpen] = useState(false)
  const [isCommandsOpen, setIsCommandsOpen] = useState(false)
  const serviceMenuRef = useRef<HTMLDivElement>(null)
  const serviceTriggerRef = useRef<HTMLButtonElement>(null)
  const [useMyPet, setUseMyPet] = useState(snapshot?.controls.useMyPet ?? false)
  const [selectedPetId, setSelectedPetId] = useState(snapshot?.controls.petId ?? 0)
  const [sortBy, setSortBy] = useState<SortMode>(snapshot?.controls.sortBy ?? 'ranking')
  const [onlyWithPhoto, setOnlyWithPhoto] = useState(snapshot?.controls.onlyWithPhoto ?? false)
  const [onlyFavorites, setOnlyFavorites] = useState(snapshot?.controls.onlyFavorites ?? false)
  const [resultsPerRow, setResultsPerRow] = useState(snapshot?.columns ?? 3)
  const [selectedFeatureIdsByService, setSelectedFeatureIdsByService] = useState<Record<number, number[]>>(snapshot?.controls.features ?? {})
  const [searchedFeatureIdsByService, setSearchedFeatureIdsByService] = useState<Record<number, number[]>>({})
  const [results, setResults] = useState<AssistantResult[]>([])
  const [visibleResultCount, setVisibleResultCount] = useState(8)
  const [matchedPetName, setMatchedPetName] = useState('')
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [toast, setToast] = useState<{ message: string; tone: 'error' | 'success' } | null>(null)
  const toastNotice = toast ? <div className={`search-toast ${toast.tone}`} role="status">{toast.message}</div> : null
  const selectedOptionCount = Object.values(selectedFeatureIdsByService).reduce((total, featureIds) => total + featureIds.length, 0)
  const selectedServices = options.services.filter((service) => selectedServiceIds.includes(service.id))
  const serviceMenuValue = selectedServices.length > 1
    ? `${selectedServices.length} servizi selezionati`
    : selectedServices[0]?.name ?? 'Seleziona i servizi'
  const appliedOptionFilters = selectedServices.flatMap((service) =>
    service.features
      .filter((feature) => searchedFeatureIdsByService[service.id]?.includes(feature.id))
      .map((feature) => ({ serviceId: service.id, serviceName: service.name, feature }))
  )

  useLayoutEffect(() => {
    if (results.length > 0 && pendingScroll.current !== null) {
      window.scrollTo(0, pendingScroll.current)
      pendingScroll.current = null
    }
  }, [results])

  useEffect(() => {
    if (!isServiceMenuOpen) return

    function closeServiceMenu(event: PointerEvent) {
      if (event.target instanceof Node && !serviceMenuRef.current?.contains(event.target)) {
        setIsServiceMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeServiceMenu)
    return () => document.removeEventListener('pointerdown', closeServiceMenu)
  }, [isServiceMenuOpen])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timer = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function executeSearch(
    serviceIds: number[],
    petId: number,
    from: string,
    to: string,
    featureFilters: Record<number, number[]> = selectedFeatureIdsByService,
  ) {
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

    await runSearch({
      startDate: from,
      endDate: to,
      serviceIds,
      petId: useMyPet ? petId : null,
      durationMinutes: 30,
      sortBy,
      onlyWithPhoto,
      onlyFavorites,
      optionFilters: Object.entries(featureFilters)
        .map(([serviceId, featureIds]) => ({ serviceId: Number(serviceId), featureIds }))
        .filter((filter) => serviceIds.includes(filter.serviceId) && filter.featureIds.length > 0),
    })
  }

  const runSearch = useCallback(async (query: SearchQuery, visible = 8) => {
    setIsSearching(true)
    try {
      const response = await fetch('/api/search/pet-assistants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(query),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Ricerca non completata.')
      }

      const data = payload.data as SearchResponse
      setResults(data.results)
      setVisibleResultCount(visible)
      setMatchedPetName(data.pet?.name ?? '')
      setLastQuery(query)
      setSearchedFeatureIdsByService(Object.fromEntries(query.optionFilters.map(({ serviceId, featureIds }) => [serviceId, featureIds])))
      setHasSearched(true)
    } catch (error) {
      setResults([])
      setVisibleResultCount(8)
      setMatchedPetName('')
      setLastQuery(null)
      pendingScroll.current = null
      setSearchedFeatureIdsByService({})
      setHasSearched(true)
      setToast({
        message: error instanceof Error ? error.message : 'Ricerca non completata.',
        tone: 'error',
      })
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (restored.current) return
    restored.current = true

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
        setOptions(nextOptions)
        if (!nextOptions.canFilterFavorites) setOnlyFavorites(false)
        if (nextOptions.pets.length > 0) {
          setSelectedPetId((current) => nextOptions.pets.some((pet) => pet.id === current) ? current : nextOptions.pets[0].id)
        }
        if (snapshot) {
          await runSearch({ ...snapshot.query, onlyFavorites: Boolean(snapshot.query.onlyFavorites && nextOptions.canFilterFavorites) }, snapshot.visible)
        }
      } catch {
        setToast({ message: 'Ricerca momentaneamente non disponibile.', tone: 'error' })
      } finally {
        setIsLoadingOptions(false)
      }
    }

    void loadOptions()
  }, [snapshot, runSearch])

  useEffect(() => {
    if (!lastQuery) return

    function refreshRestoredResults(event: PageTransitionEvent) {
      if (event.persisted && lastQuery) void runSearch(lastQuery, visibleResultCount)
    }

    window.addEventListener('pageshow', refreshRestoredResults)
    return () => window.removeEventListener('pageshow', refreshRestoredResults)
  }, [lastQuery, runSearch, visibleResultCount])

  function toggleService(serviceId: number) {
    if (!selectedServiceIds.includes(serviceId)) {
      setSelectedServiceIds([...selectedServiceIds, serviceId])
      return
    }

    setSelectedServiceIds(selectedServiceIds.filter((id) => id !== serviceId))
    setSelectedFeatureIdsByService((selected) => {
      const next = { ...selected }
      delete next[serviceId]
      return next
    })
  }

  function toggleServiceFeature(serviceId: number, featureId: number) {
    setSelectedFeatureIdsByService((current) => {
      const selected = current[serviceId] ?? []
      const nextSelected = selected.includes(featureId)
        ? selected.filter((id) => id !== featureId)
        : [...selected, featureId]

      if (nextSelected.length === 0) {
        const next = { ...current }
        delete next[serviceId]
        return next
      }

      return { ...current, [serviceId]: nextSelected }
    })
  }

  function clearOptionFilters() {
    setSelectedFeatureIdsByService({})
  }

  function removeAppliedOption(serviceId: number, featureId: number) {
    const nextFilters = { ...selectedFeatureIdsByService }
    const nextFeatureIds = (nextFilters[serviceId] ?? []).filter((id) => id !== featureId)
    if (nextFeatureIds.length > 0) {
      nextFilters[serviceId] = nextFeatureIds
    } else {
      delete nextFilters[serviceId]
    }

    setSelectedFeatureIdsByService(nextFilters)
    void executeSearch(selectedServiceIds, selectedPetId, startDate, endDate, nextFilters)
  }

  function profileHref(assistant: AssistantResult): string {
    const base = `/pet-assistants/${assistant.id}`
    if (!lastQuery) return base
    const matches = assistant.matchedServices.map(({ id }) => id)
    const params = new URLSearchParams({
      from: lastQuery.startDate,
      to: lastQuery.endDate,
      services: matches.join(','),
    })
    for (const filter of lastQuery.optionFilters) {
      if (matches.includes(filter.serviceId)) {
        params.append('options', `${filter.serviceId}:${filter.featureIds.join(',')}`)
      }
    }
    return `${base}?${params}`
  }

  function saveSearch() {
    if (!lastQuery) return
    const state: SearchSnapshot = {
      query: lastQuery,
      columns: resultsPerRow,
      visible: visibleResultCount,
      scroll: window.scrollY,
      controls: { startDate, endDate, serviceIds: selectedServiceIds, petId: selectedPetId, useMyPet, sortBy,
        onlyWithPhoto, onlyFavorites, features: selectedFeatureIdsByService },
    }
    window.history.replaceState({ ...window.history.state, [SEARCH_STATE_KEY]: state }, '')
    try {
      window.sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(state))
    } catch {
      // Browser history remains available when tab storage is disabled.
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
          <div className="search-primary-grid">
            <div
              ref={serviceMenuRef}
              className="search-field search-services"
              onBlur={(event) => {
                if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
                  setIsServiceMenuOpen(false)
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && isServiceMenuOpen) {
                  setIsServiceMenuOpen(false)
                  serviceTriggerRef.current?.focus()
                }
              }}
            >
              <span id="search-services-label">Servizi</span>
              <button
                ref={serviceTriggerRef}
                className={`portal-combobox-trigger${isServiceMenuOpen ? ' is-open' : ''}`}
                type="button"
                aria-labelledby="search-services-label search-services-value"
                aria-controls="search-services-menu"
                aria-expanded={isServiceMenuOpen}
                disabled={isLoadingOptions || options.services.length === 0}
                onClick={(event) => {
                  event.currentTarget.focus()
                  setIsServiceMenuOpen((open) => !open)
                }}
              >
                <span id="search-services-value">{serviceMenuValue}</span>
              </button>
              <fieldset id="search-services-menu" className="search-service-options" aria-labelledby="search-services-label" hidden={!isServiceMenuOpen}>
                {options.services.map((service) => (
                  <label className="search-service-option" key={service.id}>
                    <input
                      type="checkbox"
                      checked={selectedServiceIds.includes(service.id)}
                      onChange={() => toggleService(service.id)}
                    />
                    <span className="search-service-check" aria-hidden="true">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m4 8 2.5 2.5L12 5" />
                      </svg>
                    </span>
                    <span>{service.name}</span>
                  </label>
                ))}
              </fieldset>
            </div>
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
            <div className="search-field">
              <span>Pet</span>
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
                <select aria-label="Seleziona il pet" className="portal-combobox" value={selectedPetId} onChange={(event) => setSelectedPetId(Number(event.target.value))}>
                  {options.pets.map((pet) => (
                    <option key={pet.id} value={pet.id}>{pet.name}</option>
                  ))}
                </select>
              ) : null}
            </div>
            <div className="search-field">
              <span>Funzioni</span>
              <button
                className={`portal-combobox-trigger${isCommandsOpen ? ' is-open' : ''}`}
                type="button"
                aria-controls="search-service-commands"
                aria-expanded={isCommandsOpen}
                onClick={() => setIsCommandsOpen((open) => !open)}
              >
                Comandi{selectedOptionCount > 0 ? ` (${selectedOptionCount})` : ''}
              </button>
            </div>
          </div>

          <div id="search-service-commands" className="search-options-panel" hidden={!isCommandsOpen}>
            <div className="search-options-panel-heading">
              <div>
                <strong>Funzioni per servizio</strong>
                <p>{selectedServices.length > 0
                  ? 'Il Pet Assistant dovrà offrire tutte le funzioni selezionate per ciascun servizio.'
                  : 'Seleziona uno o più servizi per vedere le funzioni disponibili.'}</p>
              </div>
              {selectedOptionCount > 0 ? (
                <button type="button" onClick={clearOptionFilters}>Rimuovi selezioni</button>
              ) : null}
            </div>
            <div className="search-options-services">
              {selectedServices.map((service) => {
                const selectedIds = selectedFeatureIdsByService[service.id] ?? []
                return (
                  <fieldset className="search-option-service" key={service.id}>
                    <legend>
                      {service.name}
                      {selectedIds.length > 0 ? <span>{selectedIds.length}</span> : null}
                    </legend>
                    <div className="search-option-chips">
                      {service.features.length === 0 ? <p>Nessuna funzione configurata.</p> : null}
                      {service.features.map((feature) => {
                        const selected = selectedIds.includes(feature.id)
                        return (
                          <label className={selected ? 'is-selected' : ''} key={feature.id}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleServiceFeature(service.id, feature.id)}
                            />
                            <span aria-hidden="true">✓</span>
                            {feature.name}
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>
                )
              })}
            </div>
          </div>

          <div className="search-submit-row">
            <label className="search-field search-sort">
              <span>Ordina per</span>
              <select className="portal-combobox" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
                <option value="ranking">Miglior ranking</option>
                <option value="distance">Più vicino</option>
                <option value="cost">Costo minore</option>
                <option value="cost_desc">Costo maggiore</option>
              </select>
            </label>
            <label className="search-photo-filter">
              <input
                type="checkbox"
                checked={onlyWithPhoto}
                onChange={(event) => setOnlyWithPhoto(event.target.checked)}
              />
              <span className="search-photo-filter-check" aria-hidden="true">✓</span>
              <span>Solo profili con foto</span>
            </label>
            <label className="search-favorites-filter">
              <input
                type="checkbox"
                checked={onlyFavorites && options.canFilterFavorites}
                disabled={isLoadingOptions}
                onChange={(event) => {
                  if (options.canFilterFavorites) setOnlyFavorites(event.target.checked)
                  else setToast({ message: 'Accedi come Pet Owner per cercare tra i preferiti.', tone: 'error' })
                }}
              />
              <span className="search-photo-filter-check" aria-hidden="true">
                <FavoriteHeart />
              </span>
              <span>Solo profili preferiti</span>
            </label>
            <div className="search-field">
              <span id="search-result-layout-label">Card per riga</span>
              <div className="search-result-layout" role="radiogroup" aria-labelledby="search-result-layout-label">
                {[1, 2, 3].map((columns) => {
                  const cardWidth = (20 - 2 * (columns - 1)) / columns
                  const label = `${columns} card per riga`
                  return (
                    <label key={columns} title={label}>
                      <input
                        type="radio"
                        name="results-per-row"
                        aria-label={label}
                        checked={resultsPerRow === columns}
                        onChange={() => setResultsPerRow(columns)}
                      />
                      <svg viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        {Array.from({ length: columns }, (_, index) => (
                          <rect key={index} x={2 + index * (cardWidth + 2)} y="4" width={cardWidth} height="12" rx="1" />
                        ))}
                      </svg>
                    </label>
                  )
                })}
              </div>
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

          {hasSearched && appliedOptionFilters.length > 0 ? (
            <div className="search-applied-options" aria-label="Opzioni applicate alla ricerca">
              <span>Opzioni richieste</span>
              <div>
                {appliedOptionFilters.map(({ serviceId, serviceName, feature }) => (
                  <button
                    type="button"
                    key={`${serviceId}-${feature.id}`}
                    onClick={() => removeAppliedOption(serviceId, feature.id)}
                    title={`Rimuovi ${feature.name} da ${serviceName}`}
                  >
                    <span>{serviceName}</span> · {feature.name} <b aria-hidden="true">×</b>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!hasSearched && !isSearching ? (
            <div className="search-empty-state search-initial-state">
              <SearchIcon />
              <h3>Trova il Pet Assistant più adatto</h3>
              <p>Seleziona uno o più servizi, le date e, se vuoi, il tuo pet. Poi avvia la ricerca.</p>
            </div>
          ) : null}

          {hasSearched && !isSearching && results.length === 0 ? (
            <div className="search-empty-state">
              <PetIcon />
              {lastQuery?.onlyFavorites ? (
                <h3>Nessun profilo preferito corrisponde ai filtri selezionati</h3>
              ) : <>
                <h3>Nessun Pet Assistant disponibile</h3>
                <p>Prova ad ampliare l’intervallo di date oppure seleziona altri servizi.</p>
              </>}
            </div>
          ) : null}

          <div className="assistant-results-list" data-columns={resultsPerRow}>
            {results.slice(0, visibleResultCount).map((assistant) => {
              const rates = assistant.matchedServices.map((service) => service.hourlyRate).filter((rate) => rate > 0)
              const hourlyRate = rates.length > 0 ? Math.min(...rates) : null
              const isWide = resultsPerRow === 1
              const showCredentials = isWide && (assistant.titles.length > 0 || Boolean(assistant.petMatch))
              const previewServices = assistant.matchedServices.slice(0, isWide ? 3 : 2)
              const remainingServices = assistant.matchedServices.length - previewServices.length

              return (
                <article className="assistant-card" key={assistant.id}>
                  <div className="assistant-identity">
                    <AssistantPhoto assistant={assistant} />
                    <div>
                      <h3><a className="assistant-card-link" href={profileHref(assistant)} title="Apri profilo" onClick={saveSearch} onAuxClick={saveSearch}>{assistant.name}</a></h3>
                      <p className="assistant-meta">
                        {assistant.city || 'Città non indicata'}
                        {assistant.distanceKm === null ? null : ` · ${assistant.distanceKm.toLocaleString('it-IT')} km`}
                      </p>
                      <RankingStars score={assistant.rankingScore} stars={assistant.stars} />
                      {isWide && assistant.experienceYears > 0 ? (
                        <p className="assistant-meta">
                          {assistant.experienceYears} {assistant.experienceYears === 1 ? 'anno' : 'anni'} di esperienza
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {resultsPerRow < 3 ? (
                    <div className="assistant-card-preview">
                      {assistant.bio || showCredentials ? (
                        <div>
                          {assistant.bio ? <p className="assistant-bio">{assistant.bio}</p> : null}
                          {showCredentials ? (
                            <div className="assistant-title-list">
                              {assistant.titles.slice(0, 3).map((title) => <span key={title}>{title}</span>)}
                              {assistant.petMatch ? <span className="assistant-match-badge">{assistant.petMatch}</span> : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="assistant-card-preview-services">
                        <strong>Servizi trovati</strong>
                        <ul>
                          {previewServices.map((service) => <li key={service.id}>{service.name}</li>)}
                          {remainingServices > 0 ? <li>+{remainingServices} {remainingServices === 1 ? 'altro' : 'altri'}</li> : null}
                        </ul>
                        {assistant.firstAvailableDate ? (
                          <p>Prima disponibilità <time dateTime={assistant.firstAvailableDate}>{formatDate(assistant.firstAvailableDate)}</time></p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="assistant-card-footer">
                    <p className="assistant-card-rate">
                      {hourlyRate === null ? 'Tariffa non indicata' : <>Da <strong>{formatPrice(hourlyRate)}</strong> / ora</>}
                    </p>
                    <div className="assistant-card-icons">
                      <span className={`assistant-card-favorite${assistant.favorite ? ' is-favorite' : ''}`} role="img" aria-label={assistant.favorite ? 'Nei preferiti' : 'Non nei preferiti'}>
                        <FavoriteHeart />
                      </span>
                      <span className="assistant-card-profile-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2.75" y="5.5" width="18.5" height="13" rx="2.8" />
                          <circle cx="8.7" cy="10.1" r="1.65" />
                          <path d="M5.8 15.35a3 3 0 0 1 5.8 0M14.4 10.25h3.4m-3.4 3.5h3.4" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </article>
              )
            })}
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
        <PublicFooter />
      </section>

      {toastNotice}
    </main>
  )
}
