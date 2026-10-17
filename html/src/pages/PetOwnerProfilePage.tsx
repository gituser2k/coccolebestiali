import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import logoImage from '../assets/logo.png'
import '../css/profile.css'
import { sanitizeText } from '../utility.js'
import AccountChangeModal, { SocialAccountSwitchActions } from '../components/AccountChangeModal.tsx'
import { FieldLabel, FieldLegend } from '../components/ProfileFieldMeta.tsx'
import PetOwnerPetsSection, { PetsIcon } from '../components/PetOwnerPetsSection.tsx'

type CityOption = {
  name: string
  province: string
  region: string
  label: string
}

type PersonalProfileData = {
  alias: string
  name: string
  photo: string
  photoUrl: string
  age: number
  city: string
  phone: string
  email: string
  address: string
  addressnumber: string
  locationLat: number
  locationLng: number
}

type PasswordChecks = {
  minLength: boolean
  uppercase: boolean
  lowercase: boolean
  number: boolean
  symbol: boolean
  noSpaces: boolean
}

type AuthProvider = '' | 'google' | 'apple'
type FieldVisibilityTone = 'private' | 'public'
type PersonalFieldVisibility = {
  name: FieldVisibilityTone
  phone: FieldVisibilityTone
  address: FieldVisibilityTone
  addressnumber: FieldVisibilityTone
}

const EMPTY_PROFILE: PersonalProfileData = {
  alias: '',
  name: '',
  photo: '',
  photoUrl: '',
  age: 0,
  city: '',
  phone: '',
  email: '',
  address: '',
  addressnumber: '',
  locationLat: 0,
  locationLng: 0,
}

const DEFAULT_PERSONAL_FIELD_VISIBILITY: PersonalFieldVisibility = {
  name: 'private',
  phone: 'private',
  address: 'private',
  addressnumber: 'private',
}

const AGE_OPTIONS = Array.from({ length: 83 }, (_, index) => index + 18)

function PersonalDataIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 12.25a4.13 4.13 0 1 0-4.12-4.12A4.13 4.13 0 0 0 12 12.25Zm0 2.25c-3.45 0-6.25 1.87-6.25 4.17V20h12.5v-1.33c0-2.3-2.8-4.17-6.25-4.17Z"
        fill="currentColor"
      />
    </svg>
  )
}

function getPasswordChecks(password: string): PasswordChecks {
  return {
    minLength: password.length >= 10,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9\s]/.test(password),
    noSpaces: !/\s/.test(password),
  }
}

function isPasswordValid(password: string): boolean {
  return Object.values(getPasswordChecks(password)).every(Boolean)
}

export default function PetOwnerProfilePage() {
  const [activeMenu, setActiveMenu] = useState<'personal' | 'pets'>('personal')
  const [profile, setProfile] = useState<PersonalProfileData>(EMPTY_PROFILE)
  const [fieldVisibility, setFieldVisibility] = useState<PersonalFieldVisibility>(DEFAULT_PERSONAL_FIELD_VISIBILITY)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null)
  const [isPhotoPreviewBroken, setIsPhotoPreviewBroken] = useState(false)
  const [cityOptions, setCityOptions] = useState<CityOption[]>([])
  const [isCityLoading, setIsCityLoading] = useState(false)
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false)
  const [isMapLoading, setIsMapLoading] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const leafletMapRef = useRef<L.Map | null>(null)
  const locationMarkerRef = useRef<L.Marker | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'error' | 'success'>('error')
  const [, setAuthProvider] = useState<AuthProvider>('')
  const [isAccountChangeModalOpen, setIsAccountChangeModalOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [credentialEmail, setCredentialEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isPasswordSaving, setIsPasswordSaving] = useState(false)
  const didAttemptInitialGeocodeRef = useRef(false)

  const profileEntryMode = useMemo<'register' | 'login'>(() => {
    if (typeof window === 'undefined') {
      return 'login'
    }

    const entry = sanitizeText(new URLSearchParams(window.location.search).get('entry') ?? '').toLowerCase()
    return entry === 'register' ? 'register' : 'login'
  }, [])

  const completionPercentage = useMemo(() => {
    const checks = [
      sanitizeText(profile.alias) !== '',
      sanitizeText(profile.name) !== '',
      Boolean(selectedPhotoFile || profile.photoUrl),
      profile.age > 0,
      sanitizeText(profile.city) !== '',
      sanitizeText(profile.phone) !== '',
      sanitizeText(profile.address) !== '',
      sanitizeText(profile.addressnumber) !== '',
    ]

    const completed = checks.filter(Boolean).length
    return Math.round((completed / checks.length) * 100)
  }, [
    profile.address,
    profile.addressnumber,
    profile.age,
    profile.alias,
    profile.city,
    profile.name,
    profile.phone,
    profile.photoUrl,
    selectedPhotoFile,
  ])

  const previewPhotoUrl = useMemo(() => {
    if (!selectedPhotoFile) {
      return profile.photoUrl
    }

    return URL.createObjectURL(selectedPhotoFile)
  }, [profile.photoUrl, selectedPhotoFile])

  const compactAlias = useMemo(() => {
    const alias = sanitizeText(profile.alias)
    return alias !== '' ? alias : 'Pet Owner'
  }, [profile.alias])

  const passwordChecks = useMemo(() => getPasswordChecks(newPassword), [newPassword])
  const hasPasswordInput = newPassword.length > 0
  const isPasswordConfirmationValid = confirmPassword.length > 0 && confirmPassword === newPassword
  const accountProviderLabel = 'Cambio Credenziali'
  const accountActionLabel = 'Gestisci Credenziali'

  const showProfileToast = useCallback((message: string, type: 'error' | 'success') => {
    setToastMessage(message)
    setToastType(type)
  }, [])

  function setManualMapPosition(lat: number, lng: number) {
    const nextLat = Number(lat.toFixed(7))
    const nextLng = Number(lng.toFixed(7))

    setProfile((current) => ({
      ...current,
      locationLat: nextLat,
      locationLng: nextLng,
    }))
  }

  useEffect(() => {
    if (!toastMessage) {
      return
    }

    const timer = window.setTimeout(() => setToastMessage(null), 5200)
    return () => window.clearTimeout(timer)
  }, [toastMessage])

  useEffect(() => {
    return () => {
      if (selectedPhotoFile && previewPhotoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewPhotoUrl)
      }
    }
  }, [previewPhotoUrl, selectedPhotoFile])

  useEffect(() => {
    if (activeMenu !== 'personal' || isLoading || !mapContainerRef.current || leafletMapRef.current) {
      return
    }

    const fallbackPosition: [number, number] = [41.9028, 12.4964]
    const initialPosition: [number, number] =
      profile.locationLat !== 0 && profile.locationLng !== 0
        ? [profile.locationLat, profile.locationLng]
        : fallbackPosition

    const map = L.map(mapContainerRef.current, {
      center: initialPosition,
      zoom: profile.locationLat !== 0 && profile.locationLng !== 0 ? 15 : 6,
      scrollWheelZoom: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    const markerIcon = L.divIcon({
      className: 'profile-leaflet-marker',
      html: '<span></span>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    })

    const marker = L.marker(initialPosition, {
      draggable: true,
      icon: markerIcon,
    }).addTo(map)

    marker.on('dragend', () => {
      const nextPosition = marker.getLatLng()
      setManualMapPosition(nextPosition.lat, nextPosition.lng)
    })

    leafletMapRef.current = map
    locationMarkerRef.current = marker

    window.setTimeout(() => map.invalidateSize(), 100)

    return () => {
      map.remove()
      leafletMapRef.current = null
      locationMarkerRef.current = null
    }
    // Leaflet must be mounted once after the profile form becomes visible; marker updates are handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu, isLoading])

  useEffect(() => {
    const map = leafletMapRef.current
    const marker = locationMarkerRef.current

    if (!map || !marker || profile.locationLat === 0 || profile.locationLng === 0) {
      return
    }

    const position = L.latLng(profile.locationLat, profile.locationLng)
    marker.setLatLng(position)

    if (!map.getBounds().contains(position)) {
      map.setView(position, Math.max(map.getZoom(), 14))
    }
  }, [profile.locationLat, profile.locationLng])

  useEffect(() => {
    async function loadProfileData() {
      setIsLoading(true)

      try {
        const [userResponse, profileResponse] = await Promise.all([
          fetch('/api/auth/me', { headers: { Accept: 'application/json' } }),
          fetch('/api/profile/petowner/personal', { headers: { Accept: 'application/json' } }),
        ])

        const userPayload = await userResponse.json().catch(() => ({}))
        const profilePayload = await profileResponse.json().catch(() => ({}))

        if (!userResponse.ok || !userPayload?.ok) {
          throw new Error('Sessione utente non disponibile. Effettua una nuova registrazione o autenticazione.')
        }

        if (!profileResponse.ok || !profilePayload?.ok) {
          throw new Error(profilePayload?.message || 'Profilo non disponibile.')
        }

        const provider = sanitizeText(userPayload?.data?.user?.provider ?? '').toLowerCase()
        setAuthProvider(provider === 'google' || provider === 'apple' ? provider : '')

        setProfile({
          ...EMPTY_PROFILE,
          ...profilePayload.data,
          alias: sanitizeText(profilePayload?.data?.alias ?? userPayload?.data?.user?.name ?? ''),
          email: sanitizeText(profilePayload?.data?.email ?? userPayload?.data?.user?.email ?? ''),
          locationLat: Number(profilePayload?.data?.locationLat ?? 0),
          locationLng: Number(profilePayload?.data?.locationLng ?? 0),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Profilo non disponibile.'
        showProfileToast(message, 'error')
      } finally {
        setIsLoading(false)
      }
    }

    void loadProfileData()
  }, [showProfileToast])

  useEffect(() => {
    if (!isCityDropdownOpen) {
      return
    }

    const query = sanitizeText(profile.city)
    if (query.length < 2) {
      setCityOptions([])
      setIsCityLoading(false)
      return
    }

    let ignore = false
    const timer = window.setTimeout(async () => {
      setIsCityLoading(true)

      try {
        const response = await fetch(`/api/profile/cities?query=${encodeURIComponent(query)}`, {
          headers: {
            Accept: 'application/json',
          },
        })

        const payload = await response.json().catch(() => ({}))
        if (ignore) {
          return
        }

        if (!response.ok || !payload?.ok || !Array.isArray(payload?.data)) {
          setCityOptions([])
          return
        }

        setCityOptions(payload.data)
      } catch {
        if (!ignore) {
          setCityOptions([])
        }
      } finally {
        if (!ignore) {
          setIsCityLoading(false)
        }
      }
    }, 280)

    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [isCityDropdownOpen, profile.city])

  function updateProfileField<K extends keyof PersonalProfileData>(field: K, value: PersonalProfileData[K]) {
    if (field === 'city' || field === 'address' || field === 'addressnumber') {
      didAttemptInitialGeocodeRef.current = true
    }

    setProfile((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedPhotoFile(event.target.files?.[0] ?? null)
  }

  function handleCitySelection(option: CityOption) {
    updateProfileField('city', option.name)
    setCityOptions([])
    setIsCityDropdownOpen(false)
  }

  async function updateMapPosition() {
    if (!sanitizeText(profile.city) || !sanitizeText(profile.address) || !sanitizeText(profile.addressnumber)) {
      showProfileToast('Inserisci citta, indirizzo e numero civico per visualizzare la posizione.', 'error')
      return
    }

    setIsMapLoading(true)

    try {
      const params = new URLSearchParams({
        city: sanitizeText(profile.city),
        address: sanitizeText(profile.address),
        addressnumber: sanitizeText(profile.addressnumber),
      })
      const response = await fetch(`/api/profile/geocode?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
        },
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok || !payload?.data) {
        throw new Error(payload?.message || 'Posizione non trovata.')
      }

      const nextLat = Number(payload.data.lat)
      const nextLng = Number(payload.data.lng)
      setProfile((current) => ({
        ...current,
        locationLat: nextLat,
        locationLng: nextLng,
      }))

      const map = leafletMapRef.current
      const marker = locationMarkerRef.current
      if (map) {
        const position = L.latLng(nextLat, nextLng)
        marker?.setLatLng(position)
        map.setView(position, payload?.data?.precision === 'civico' ? 16 : 15, {
          animate: true,
        })
      }

      showProfileToast(payload?.data?.label || 'Posizione aggiornata correttamente.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Geolocalizzazione non disponibile.'
      showProfileToast(`${message}. Puoi trascinare il puntino GPS sul punto corretto.`, 'error')
    } finally {
      setIsMapLoading(false)
    }
  }

  function centerMapOnMarker() {
    const map = leafletMapRef.current
    if (!map) {
      showProfileToast('Mappa non ancora pronta.', 'error')
      return
    }

    if (profile.locationLat === 0 || profile.locationLng === 0) {
      showProfileToast('Imposta prima il punto GPS con Aggiorna Mappa.', 'error')
      return
    }

    map.panTo([profile.locationLat, profile.locationLng], {
      animate: true,
    })
  }

  function zoomMapOnMarker() {
    const map = leafletMapRef.current
    if (!map) {
      showProfileToast('Mappa non ancora pronta.', 'error')
      return
    }

    if (profile.locationLat === 0 || profile.locationLng === 0) {
      showProfileToast('Imposta prima il punto GPS con Aggiorna Mappa.', 'error')
      return
    }

    map.setView([profile.locationLat, profile.locationLng], 17, {
      animate: true,
    })
  }

  function validateForm() {
    const hasAlias = sanitizeText(profile.alias) !== ''
    const hasCity = sanitizeText(profile.city) !== ''

    return {
      hasAlias,
      hasCity,
      isValid: hasAlias && hasCity,
    }
  }

  async function handleSavePersonalData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validation = validateForm()

    if (!validation.isValid) {
      if (!validation.hasAlias && !validation.hasCity) {
        showProfileToast('Attenzione, i campi Alias e Città sono obbligatori', 'error')
      } else if (!validation.hasAlias) {
        showProfileToast('Attenzione, il campo Alias è obbligatorio', 'error')
      } else {
        showProfileToast('Attenzione, il campo Città è obbligatorio', 'error')
      }
      return
    }

    const body = new FormData()
    body.append('alias', sanitizeText(profile.alias))
    body.append('email', sanitizeText(profile.email).toLowerCase())
    if (sanitizeText(profile.name) !== '') {
      body.append('name', sanitizeText(profile.name))
    }
    if (profile.age > 0) {
      body.append('age', String(profile.age))
    }
    if (sanitizeText(profile.city) !== '') {
      body.append('city', sanitizeText(profile.city))
    }
    if (sanitizeText(profile.phone) !== '') {
      body.append('phone', sanitizeText(profile.phone))
    }
    if (sanitizeText(profile.address) !== '') {
      body.append('address', sanitizeText(profile.address))
    }
    if (sanitizeText(profile.addressnumber) !== '') {
      body.append('addressnumber', sanitizeText(profile.addressnumber))
    }
    if (profile.locationLat !== 0 && profile.locationLng !== 0) {
      body.append('locationLat', String(profile.locationLat))
      body.append('locationLng', String(profile.locationLng))
    }
    if (selectedPhotoFile) {
      body.append('photo', selectedPhotoFile)
    }

    setIsSaving(true)

    try {
      const response = await fetch('/api/profile/petowner/personal', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body,
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Salvataggio non completato.')
      }

      setProfile((current) => ({
        ...current,
        ...payload.data,
      }))
      setSelectedPhotoFile(null)
      showProfileToast(payload?.message || 'Dati personali salvati con successo.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Salvataggio non completato.'
      showProfileToast(message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedEmail = sanitizeText(credentialEmail).toLowerCase()
    const shouldChangePassword = newPassword.length > 0 || confirmPassword.length > 0

    if (!normalizedEmail) {
      showProfileToast('Attenzione, il campo Email e obbligatorio.', 'error')
      return
    }

    if (shouldChangePassword && !isPasswordValid(newPassword)) {
      showProfileToast('La password inserita non rispetta i criteri previsti.', 'error')
      return
    }

    if (shouldChangePassword && newPassword !== confirmPassword) {
      showProfileToast('Le password inserite non coincidono.', 'error')
      return
    }

    setIsPasswordSaving(true)

    try {
      const response = await fetch('/api/profile/petowner/password', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password: shouldChangePassword ? newPassword : null,
          password_confirmation: shouldChangePassword ? confirmPassword : null,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Salvataggio credenziali non completato.')
      }

      setNewPassword('')
      setConfirmPassword('')
      setProfile((current) => ({
        ...current,
        email: sanitizeText(payload?.data?.email ?? normalizedEmail),
      }))
      setIsPasswordModalOpen(false)
      showProfileToast(payload?.message || 'Credenziali aggiornate con successo.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Salvataggio credenziali non completato.'
      showProfileToast(message, 'error')
    } finally {
      setIsPasswordSaving(false)
    }
  }

  function handleAccountAction() {
    setCredentialEmail(profile.email)
    setIsPasswordModalOpen(true)
  }

  function toggleFieldVisibility(field: keyof PersonalFieldVisibility) {
    setFieldVisibility((current) => {
      const nextTone = current[field] === 'private' ? 'public' : 'private'
      const nextVisibility = {
        ...current,
        [field]: nextTone,
      }

      if (field === 'addressnumber' && nextTone === 'public') {
        nextVisibility.address = 'public'
      }

      return nextVisibility
    })
  }

  function handleAccountChanged(user: Record<string, unknown>, message: string) {
    const provider = sanitizeText(user.provider ?? '').toLowerCase()
    setAuthProvider(provider === 'google' || provider === 'apple' ? provider : '')
    setProfile((current) => ({
      ...current,
      alias: sanitizeText(user.name ?? current.alias),
      email: sanitizeText(user.email ?? current.email),
    }))
    setIsAccountChangeModalOpen(false)
    showProfileToast(message, 'success')
  }

  return (
    <main className="register-shell">
      <section className="register-hero profile-shell-panel" aria-label="Profilo Pet Owner Coccole Bestiali">
        <div className="register-topbar">
          <a href="/" className="register-brand-link" aria-label="Torna alla home">
            <img src={logoImage} className="register-logo" alt="Coccole Bestiali" />
          </a>
          <header className="register-header">
            <div className="profile-header-main">
              <div className="profile-header-copy" aria-live="polite">
                {profileEntryMode === 'register' ? (
                  <>
                    <span className="profile-header-eyebrow">BENVENUTO NEL PORTALE</span>
                    <strong className="profile-header-title">Registrazione Profilo</strong>
                  </>
                ) : (
                  <>
                    <span className="profile-header-eyebrow">AREA RISERVATA</span>
                    <strong className="profile-header-title">Ciao {compactAlias}</strong>
                  </>
                )}
              </div>
              {profileEntryMode === 'login' ? (
                <div className="profile-completion-chip profile-completion-chip-compact" aria-live="polite">
                  <span className="profile-completion-pill">{completionPercentage}%</span>
                  <span className="profile-completion-copy">Profilo completato</span>
                </div>
              ) : null}
            </div>
            <a className="register-home-link" href="/">
              Torna alla Home
            </a>
          </header>
        </div>

        <section className="profile-layout" aria-label="Area profilo pet owner">
          <aside className="profile-sidebar" aria-label="Menu profilo">
            <nav className="profile-menu">
              <button
                className={`profile-menu-item is-personal ${activeMenu === 'personal' ? 'is-active' : ''}`}
                type="button"
                onClick={() => setActiveMenu('personal')}
              >
                <span className="profile-menu-badge" aria-hidden="true">
                  <PersonalDataIcon />
                </span>
                <span className="profile-menu-copy">
                  <strong>DATI PERSONALI</strong>
                  <small>Informazioni anagrafiche, recapiti e foto profilo</small>
                </span>
              </button>
              <button
                className={`profile-menu-item is-operator ${activeMenu === 'pets' ? 'is-active' : ''}`}
                type="button"
                onClick={() => setActiveMenu('pets')}
              >
                <span className="profile-menu-badge" aria-hidden="true">
                  <PetsIcon />
                </span>
                <span className="profile-menu-copy">
                  <strong>IL MIO PET</strong>
                </span>
              </button>
            </nav>
          </aside>

          <section className="profile-stage" aria-label="Contenuto pagina">
            <div className="profile-stage-card">
              <p className="profile-stage-kicker">PROFILO PET OWNER</p>
              {activeMenu === 'personal' ? (
                <>
                  <div className="profile-stage-title-row">
                    <h1 className="profile-stage-title">Dati personali</h1>
                    <FieldLegend />
                  </div>

                  {isLoading ? (
                    <div className="profile-loading-card">Caricamento dati personali in corso...</div>
                  ) : (
                    <form id="profile-petowner-personal-form" className="profile-form" onSubmit={handleSavePersonalData}>
                  <section className="profile-form-section profile-photo-section">
                    <div className="profile-identity-grid">
                      <label className="profile-field">
                        <FieldLabel tone="required">Alias</FieldLabel>
                        <input
                          type="text"
                          value={profile.alias}
                          onChange={(event) => updateProfileField('alias', event.target.value)}
                        />
                      </label>
                      <label className="profile-field">
                        <FieldLabel tone={fieldVisibility.name} onToneToggle={() => toggleFieldVisibility('name')}>Nome e Cognome</FieldLabel>
                        <input
                          type="text"
                          value={profile.name}
                          onChange={(event) => updateProfileField('name', event.target.value)}
                        />
                      </label>
                      <label className="profile-field profile-email-field">
                        <FieldLabel>Email</FieldLabel>
                        <input
                          type="email"
                          value={profile.email}
                          readOnly
                          className="is-readonly"
                        />
                      </label>
                      <div className="profile-field profile-password-action-field">
                        <span>{accountProviderLabel}</span>
                        <button
                          type="button"
                          className="profile-password-button"
                          onClick={handleAccountAction}
                        >
                          {accountActionLabel}
                        </button>
                      </div>
                    </div>
                    <div className="profile-photo-card">
                      <div className="profile-photo-frame">
                        {previewPhotoUrl && !isPhotoPreviewBroken ? (
                          <img
                            src={previewPhotoUrl}
                            alt="Anteprima foto profilo"
                            className="profile-photo-image"
                            onError={() => setIsPhotoPreviewBroken(true)}
                          />
                        ) : (
                          <span className="profile-photo-placeholder">Foto profilo</span>
                        )}
                      </div>
                      <label className="profile-upload-button">
                        Carica foto
                        <input type="file" accept="image/*" onChange={handlePhotoChange} />
                      </label>
                    </div>
                  </section>

                  <section className="profile-form-grid profile-form-section">
                    <label className="profile-field">
                      <FieldLabel>Età</FieldLabel>
                      <input
                        type="text"
                        list="profile-petowner-age-options"
                        value={profile.age ? String(profile.age) : ''}
                        placeholder="Seleziona"
                        inputMode="numeric"
                        onChange={(event) => {
                          const rawValue = event.target.value.replace(/[^\d]/g, '')
                          updateProfileField('age', rawValue ? Number(rawValue) : 0)
                        }}
                      />
                      <datalist id="profile-petowner-age-options">
                        {AGE_OPTIONS.map((age) => (
                          <option key={age} value={String(age)} />
                        ))}
                      </datalist>
                    </label>
                    <label className="profile-field">
                      <FieldLabel tone={fieldVisibility.phone} onToneToggle={() => toggleFieldVisibility('phone')}>Numero di Telefono</FieldLabel>
                      <input
                        type="tel"
                        value={profile.phone}
                        onChange={(event) => updateProfileField('phone', event.target.value)}
                      />
                    </label>
                  </section>

                  <section className="profile-form-section profile-location-section">
                    <div className="profile-location-copy">
                      <p className="profile-location-kicker">
                       INDIRIZZO LOCAZIONE
                      </p>
                      <div className="profile-map-toolbar" aria-label="Controlli mappa">
                        <button
                          type="button"
                          className="profile-map-button is-secondary is-compact"
                          onClick={centerMapOnMarker}
                        >
                          <svg className="profile-map-button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M12 3v3.2M12 17.8V21M3 12h3.2M17.8 12H21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <circle cx="12" cy="12" r="4.6" fill="none" stroke="currentColor" strokeWidth="2" />
                            <circle cx="12" cy="12" r="1.35" fill="currentColor" />
                          </svg>
                          <span>Centra</span>
                        </button>
                        <button
                          type="button"
                          className="profile-map-button is-secondary is-compact"
                          onClick={zoomMapOnMarker}
                        >
                          <svg className="profile-map-button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M5 10V5h5M19 14v5h-5M5 5l6 6M19 19l-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="2.4" fill="currentColor" />
                          </svg>
                          <span>Zoom</span>
                        </button>
                      </div>
                    </div>
                    <div className="profile-location-grid">
                      <div>
                        <label className="profile-field profile-field-gap">
                          <FieldLabel tone="required">Città</FieldLabel>
                          <input
                            type="text"
                            value={profile.city}
                            placeholder="Cerca un comune italiano"
                            autoComplete="off"
                            onFocus={() => setIsCityDropdownOpen(true)}
                            onBlur={() => {
                              window.setTimeout(() => setIsCityDropdownOpen(false), 140)
                            }}
                            onChange={(event) => {
                              updateProfileField('city', event.target.value)
                              setIsCityDropdownOpen(true)
                            }}
                          />
                          {isCityDropdownOpen ? (
                            <div className="profile-city-dropdown">
                              {isCityLoading ? (
                                <div className="profile-city-state">Ricerca comuni in corso...</div>
                              ) : cityOptions.length > 0 ? (
                                cityOptions.map((option) => (
                                  <button
                                    key={`${option.name}-${option.province}-${option.region}`}
                                    type="button"
                                    className="profile-city-option"
                                    onMouseDown={() => handleCitySelection(option)}
                                  >
                                    <strong>{option.name}</strong>
                                    <span>{option.province ? `${option.province} · ` : ''}{option.region}</span>
                                  </button>
                                ))
                              ) : sanitizeText(profile.city).length >= 2 ? (
                                <div className="profile-city-state">Nessun comune trovato.</div>
                              ) : (
                                <div className="profile-city-state">Scrivi almeno 2 lettere.</div>
                              )}
                            </div>
                          ) : null}
                        </label>
                        <div className="profile-location-inline profile-field-gap">
                          <label className="profile-field">
                            <FieldLabel tone={fieldVisibility.address} onToneToggle={() => toggleFieldVisibility('address')}>Indirizzo</FieldLabel>
                            <input
                              type="text"
                              value={profile.address}
                              placeholder="Indirizzo"
                              onChange={(event) => updateProfileField('address', event.target.value)}
                            />
                          </label>
                          <label className="profile-field">
                            <FieldLabel tone={fieldVisibility.addressnumber} onToneToggle={() => toggleFieldVisibility('addressnumber')}>Numero civico</FieldLabel>
                            <input
                              type="text"
                              value={profile.addressnumber}
                              placeholder="Numero civico"
                              onChange={(event) => updateProfileField('addressnumber', event.target.value)}
                            />
                          </label>
                        </div>
                        <div className="profile-map-actions">
                          <button
                            type="button"
                            className="profile-map-button"
                            onClick={() => void updateMapPosition()}
                            disabled={isMapLoading}
                          >
                            {isMapLoading ? 'Aggiornamento Mappa...' : 'Aggiorna Mappa'}
                          </button>
                        </div>
                      </div>
                      <div className="profile-map-card">
                        <div
                          ref={mapContainerRef}
                          className="profile-map-frame"
                          aria-label="Mappa interattiva posizione pet owner"
                        />
                        <div className="profile-map-readout">
                          {profile.locationLat !== 0 && profile.locationLng !== 0 ? (
                            <>
                              <strong>Punto GPS impostato</strong>
                              <span>{profile.locationLat.toFixed(6)}, {profile.locationLng.toFixed(6)}</span>
                            </>
                          ) : (
                            <>
                              <strong>Punto GPS non ancora impostato</strong>
                              <span>Usa Aggiorna Mappa oppure trascina il puntino GPS dopo aver individuato la zona corretta.</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                    </form>
                  )}
                </>
              ) : (
                <>
                  <div className="profile-stage-title-row">
                    <h1 className="profile-stage-title">Il mio pet</h1>
                  </div>
                  <PetOwnerPetsSection onToast={showProfileToast} />
                </>
              )}
            </div>
          </section>
        </section>
      </section>

      {!isLoading && activeMenu === 'personal' ? (
        <div className="profile-floating-actions">
          <button type="submit" form="profile-petowner-personal-form" className="profile-save-button" disabled={isSaving}>
            <span className="profile-save-button-label">Salva dati</span>
            {isSaving ? <span className="profile-save-button-spinner" aria-hidden="true" /> : null}
          </button>
        </div>
      ) : null}

      {isPasswordModalOpen ? (
        <div className="profile-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
          <form className="profile-password-modal" onSubmit={handleChangePassword}>
            <div className="profile-modal-head">
              <div>
                <h2 id="change-password-title" className="profile-modal-title">Gestisci Credenziali</h2>
              </div>
              <button
                type="button"
                className="profile-modal-close"
                aria-label="Chiudi modale gestione credenziali"
                onClick={() => {
                  setIsPasswordModalOpen(false)
                  setCredentialEmail('')
                  setNewPassword('')
                  setConfirmPassword('')
                }}
              >
                ×
              </button>
            </div>

            <label className="profile-field profile-password-modal-field">
              <span>Email</span>
              <input
                type="email"
                value={credentialEmail}
                onChange={(event) => setCredentialEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <div className="profile-credentials-row">
              <label className="profile-field profile-password-modal-field">
                <span>Password</span>
                <input
                  type="password"
                  placeholder="Inserisci password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </label>

              <div className="profile-confirm-credentials">
                <label className="profile-field profile-password-modal-field">
                  <span>Conferma Password</span>
                  <input
                    type="password"
                    placeholder="Conferma password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                </label>
                <div className="profile-modal-actions profile-modal-actions-inline">
                  <button
                    type="button"
                    className="profile-modal-button is-secondary"
                    disabled={isPasswordSaving}
                    onClick={() => {
                      setIsPasswordModalOpen(false)
                      setCredentialEmail('')
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                  >
                    Annulla
                  </button>
                  <button type="submit" className="profile-modal-button is-primary" disabled={isPasswordSaving}>
                    {isPasswordSaving ? 'Salvataggio...' : 'Salva Credenziali'}
                  </button>
                </div>
              </div>
            </div>

            <div className="profile-password-guidance" aria-live="polite">
              <strong className="profile-password-guidance-title">La password deve contenere:</strong>
              <div className="profile-password-rule-list">
                <span className={`profile-password-rule ${passwordChecks.minLength ? 'is-valid' : hasPasswordInput ? 'is-invalid' : ''}`}>10+ caratteri</span>
                <span className={`profile-password-rule ${passwordChecks.uppercase ? 'is-valid' : hasPasswordInput ? 'is-invalid' : ''}`}>1 maiuscola</span>
                <span className={`profile-password-rule ${passwordChecks.lowercase ? 'is-valid' : hasPasswordInput ? 'is-invalid' : ''}`}>1 minuscola</span>
                <span className={`profile-password-rule ${passwordChecks.number ? 'is-valid' : hasPasswordInput ? 'is-invalid' : ''}`}>1 numero</span>
                <span className={`profile-password-rule ${passwordChecks.symbol ? 'is-valid' : hasPasswordInput ? 'is-invalid' : ''}`}>1 simbolo</span>
                <span className={`profile-password-rule ${passwordChecks.noSpaces ? 'is-valid' : hasPasswordInput ? 'is-invalid' : ''}`}>nessuno spazio</span>
              </div>
            </div>

            {confirmPassword.length > 0 && !isPasswordConfirmationValid ? (
              <p className="profile-password-match-error">Le password inserite non coincidono.</p>
            ) : null}

            <div className="password-social-switch">
              <div className="register-divider" aria-hidden="true">
                <span>oppure passa a</span>
              </div>
              <SocialAccountSwitchActions
                role="pet_owner"
                buttonPrefix="Passa a"
                onChanged={handleAccountChanged}
                onError={(message) => showProfileToast(message, 'error')}
              />
            </div>
          </form>
        </div>
      ) : null}

      {isAccountChangeModalOpen ? (
        <AccountChangeModal
          role="pet_owner"
          onClose={() => setIsAccountChangeModalOpen(false)}
          onChanged={handleAccountChanged}
          onError={(message) => showProfileToast(message, 'error')}
        />
      ) : null}

      {toastMessage ? (
        <div className={`profile-toast ${toastType === 'success' ? 'is-success' : 'is-error'}`}>
          {toastMessage}
        </div>
      ) : null}
    </main>
  )
}
