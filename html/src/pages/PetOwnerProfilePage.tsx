import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import logoImage from '../assets/logo.png'
import '../css/profile.css'
import { sanitizeText } from '../utility.js'
import AccountChangeModal, { SocialAccountSwitchActions } from '../components/AccountChangeModal.tsx'
import { FieldLabel, FieldLegend } from '../components/ProfileFieldMeta.tsx'

type CityOption = {
  name: string
  province: string
  region: string
  label: string
}

type GeocodeResult = {
  lat: number
  lng: number
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
}

const ADDRESS_SUGGESTIONS = [
  'Via Roma',
  'Via Giuseppe Garibaldi',
  'Corso Italia',
  'Viale Europa',
  'Piazza Duomo',
  'Via Dante Alighieri',
  'Via Alessandro Manzoni',
  'Via Guglielmo Marconi',
  'Via Giuseppe Mazzini',
  'Lungomare Cristoforo Colombo',
]

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
  const [profile, setProfile] = useState<PersonalProfileData>(EMPTY_PROFILE)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null)
  const [isPhotoPreviewBroken, setIsPhotoPreviewBroken] = useState(false)
  const [cityOptions, setCityOptions] = useState<CityOption[]>([])
  const [isCityLoading, setIsCityLoading] = useState(false)
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false)
  const [isMapLoading, setIsMapLoading] = useState(false)
  const [geocodeResult, setGeocodeResult] = useState<GeocodeResult | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'error' | 'success'>('error')
  const [authProvider, setAuthProvider] = useState<AuthProvider>('')
  const [isAccountChangeModalOpen, setIsAccountChangeModalOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
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
  const accountProviderLabel = authProvider === 'google'
    ? 'Account Google'
    : authProvider === 'apple'
      ? 'Account Apple'
      : 'Password'
  const accountActionLabel = authProvider === '' ? 'Cambia Password' : 'Cambia Account'

  function showProfileToast(message: string, type: 'error' | 'success') {
    setToastMessage(message)
    setToastType(type)
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
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Profilo non disponibile.'
        showProfileToast(message, 'error')
      } finally {
        setIsLoading(false)
      }
    }

    void loadProfileData()
  }, [])

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
      setGeocodeResult(null)
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
      setGeocodeResult(null)
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

      setGeocodeResult({
        lat: Number(payload.data.lat),
        lng: Number(payload.data.lng),
        label: sanitizeText(payload.data.label ?? ''),
      })
      showProfileToast(payload?.data?.label || 'Posizione aggiornata correttamente.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Geolocalizzazione non disponibile.'
      setGeocodeResult(null)
      showProfileToast(message, 'error')
    } finally {
      setIsMapLoading(false)
    }
  }

  const mapEmbedUrl = useMemo(() => {
    if (!geocodeResult) {
      return ''
    }

    const delta = 0.0045
    const left = geocodeResult.lng - delta
    const right = geocodeResult.lng + delta
    const top = geocodeResult.lat + delta
    const bottom = geocodeResult.lat - delta

    return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${geocodeResult.lat}%2C${geocodeResult.lng}`
  }, [geocodeResult])

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

    if (!isPasswordValid(newPassword)) {
      showProfileToast('La password inserita non rispetta i criteri previsti.', 'error')
      return
    }

    if (newPassword !== confirmPassword) {
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
          password: newPassword,
          password_confirmation: confirmPassword,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Cambio password non completato.')
      }

      setNewPassword('')
      setConfirmPassword('')
      setIsPasswordModalOpen(false)
      showProfileToast(payload?.message || 'Password aggiornata con successo.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cambio password non completato.'
      showProfileToast(message, 'error')
    } finally {
      setIsPasswordSaving(false)
    }
  }

  function handleAccountAction() {
    if (authProvider === '') {
      setIsPasswordModalOpen(true)
      return
    }

    setIsAccountChangeModalOpen(true)
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
          <header className="register-header profile-header">
            <div className="profile-greeting-wrap">
              {profileEntryMode === 'register' ? (
                <p className="profile-greeting">Registrazione Profilo</p>
              ) : (
                <>
                  <p className="profile-greeting">Ciao {compactAlias}</p>
                  <div className="profile-completion-pill is-inline" aria-label={`Profilo completato al ${completionPercentage}%`}>
                    <span className="profile-completion-ring" style={{ '--profile-completion': `${completionPercentage}%` } as React.CSSProperties}>
                      {completionPercentage}%
                    </span>
                    <span>completato</span>
                  </div>
                </>
              )}
            </div>
            <a className="register-home-link" href="/">
              Torna alla Home
            </a>
          </header>
        </div>

        {profileEntryMode === 'register' ? (
          <div className="profile-register-status">
            <span>Completamento profilo</span>
            <strong>{completionPercentage}%</strong>
          </div>
        ) : null}

        <section className="profile-layout" aria-label="Area profilo pet owner">
          <aside className="profile-sidebar" aria-label="Menu profilo">
            <nav className="profile-menu">
              <button className="profile-menu-item is-personal is-active" type="button">
                <span className="profile-menu-badge" aria-hidden="true">
                  <PersonalDataIcon />
                </span>
                <span className="profile-menu-copy">
                  <strong>DATI PERSONALI</strong>
                  <small>Informazioni anagrafiche, recapiti e foto profilo</small>
                </span>
              </button>
            </nav>
          </aside>

          <section className="profile-stage" aria-label="Contenuto pagina">
            <div className="profile-stage-card">
              <p className="profile-stage-kicker">PROFILO PET OWNER</p>
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
                        <FieldLabel tone="private">Nome e Cognome</FieldLabel>
                        <input
                          type="text"
                          value={profile.name}
                          onChange={(event) => updateProfileField('name', event.target.value)}
                        />
                      </label>
                      <label className="profile-field profile-email-field">
                        <FieldLabel tone="required">Email</FieldLabel>
                        <input
                          type="email"
                          value={profile.email}
                          onChange={(event) => updateProfileField('email', event.target.value)}
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
                      <FieldLabel tone="private">Numero di Telefono</FieldLabel>
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
                      <p className="profile-location-text">
                        L'indirizzo sar&agrave; mostrato solo ai pet assistant coinvolti nella richiesta.
                      </p>
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
                            <FieldLabel tone="private">Indirizzo</FieldLabel>
                            <input
                              type="text"
                              list="profile-petowner-address-suggestions"
                              value={profile.address}
                              onChange={(event) => updateProfileField('address', event.target.value)}
                            />
                            <datalist id="profile-petowner-address-suggestions">
                              {ADDRESS_SUGGESTIONS.map((item) => (
                                <option key={item} value={item} />
                              ))}
                            </datalist>
                          </label>
                          <label className="profile-field">
                            <FieldLabel tone="private">Numero civico</FieldLabel>
                            <input
                              type="text"
                              value={profile.addressnumber}
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
                            {isMapLoading ? 'Aggiornamento mappa...' : 'Aggiorna mappa'}
                          </button>
                        </div>
                      </div>
                      <div className="profile-map-card">
                        {mapEmbedUrl ? (
                          <iframe
                            className="profile-map-frame"
                            src={mapEmbedUrl}
                            title="Mappa posizione indirizzo"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        ) : (
                          <div className="profile-map-placeholder">
                            La mappa verra visualizzata qui dopo il calcolo della posizione.
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                </form>
              )}
            </div>
          </section>
        </section>
      </section>

      {!isLoading ? (
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
                <p className="profile-location-kicker">SICUREZZA ACCOUNT</p>
                <h2 id="change-password-title" className="profile-modal-title">Cambia Password</h2>
              </div>
              <button
                type="button"
                className="profile-modal-close"
                aria-label="Chiudi modale cambio password"
                onClick={() => {
                  setIsPasswordModalOpen(false)
                  setNewPassword('')
                  setConfirmPassword('')
                }}
              >
                ×
              </button>
            </div>

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

            <div className="profile-modal-actions">
              <button
                type="button"
                className="profile-modal-button is-secondary"
                disabled={isPasswordSaving}
                onClick={() => {
                  setIsPasswordModalOpen(false)
                  setNewPassword('')
                  setConfirmPassword('')
                }}
              >
                Annulla
              </button>
              <button type="submit" className="profile-modal-button is-primary" disabled={isPasswordSaving}>
                {isPasswordSaving ? 'Salvataggio...' : 'Salva Password'}
              </button>
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
