import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import logoImage from '../assets/logo.png'
import '../css/profile.css'
import { sanitizeText } from '../utility.js'
import AccountChangeModal, { SocialAccountSwitchActions } from '../components/AccountChangeModal.tsx'
import { FieldLabel, FieldLegend } from '../components/ProfileFieldMeta.tsx'

type MenuKey = 'personal' | 'operator' | 'calendar'

type LanguageOption = {
  id: number
  name: string
}

type OperatorTitleOption = {
  id: number
  name: string
}

type DogBreedOption = {
  id: number
  name: string
}

type PetTypeOption = {
  id: number
  name: string
}

type HouseFeatureOption = {
  id: number
  name: string
}

type ServiceOption = {
  id: number
  name: string
  description: string
  features: Array<{
    id: number
    name: string
  }>
}

type OperatorServiceSelection = {
  serviceId: number
  featureIds: number[]
  hourlyRate: number
}

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
  languageIds: number[]
  phone: string
  email: string
  address: string
  addressnumber: string
}

type OperatorGalleryItem = {
  id: string
  photo: string
  photoUrl: string
  caption: string
  file: File | null
}

type OperatorProfileData = {
  bio: string
  experienceYears: number
  titleIds: number[]
  dogWeightLimit: number
  breedIds: number[]
  petTypeIds: number[]
  houseFeatureIds: number[]
  services: OperatorServiceSelection[]
  gallery: OperatorGalleryItem[]
}

type CalendarSlotServiceSelection = {
  serviceId: number
  enabled: boolean
  hourlyRate: number
}

type CalendarDaySlot = {
  id: string | number
  startTime: string
  endTime: string
  enabled: boolean
  services: CalendarSlotServiceSelection[]
}

type CalendarDayData = {
  date: string
  enabled: boolean
  slots: CalendarDaySlot[]
}

type CalendarDaySummary = {
  date: string
  enabled: boolean
  slotCount: number
  serviceCount: number
  totalMinutes: number
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
  languageIds: [],
  phone: '',
  email: '',
  address: '',
  addressnumber: '',
}

const EMPTY_OPERATOR_PROFILE: OperatorProfileData = {
  bio: '',
  experienceYears: 0,
  titleIds: [],
  dogWeightLimit: 0,
  breedIds: [],
  petTypeIds: [],
  houseFeatureIds: [],
  services: [],
  gallery: [],
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

function OperatorDataIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M14.85 5.32 16 4.17a1.5 1.5 0 1 1 2.12 2.12l-1.15 1.15-2.12-2.12ZM5 15.02l7.2-7.2 2.12 2.12-7.2 7.2L5 18l.68-2.98Z"
        fill="currentColor"
      />
      <path d="M4.5 19.5h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M7 3.75v2.5M17 3.75v2.5M5.5 7h13a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M4 10.5h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8.5" cy="14.5" r="1" fill="currentColor" />
      <circle cx="12" cy="14.5" r="1" fill="currentColor" />
      <circle cx="15.5" cy="14.5" r="1" fill="currentColor" />
    </svg>
  )
}

function buildAgeOptions() {
  const options: number[] = []
  for (let age = 18; age <= 100; age += 1) {
    options.push(age)
  }
  return options
}

const AGE_OPTIONS = buildAgeOptions()

function buildSequentialOptions(max: number) {
  return Array.from({ length: max }, (_, index) => index + 1)
}

const EXPERIENCE_OPTIONS = buildSequentialOptions(50)
const DOG_WEIGHT_OPTIONS = buildSequentialOptions(100)
const CALENDAR_MONTH_LABELS = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
]
const CALENDAR_WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const QUARTER_HOUR_OPTIONS = Array.from({ length: 24 * 4 }, (_, index) => {
  const hours = Math.floor(index / 4)
  const minutes = (index % 4) * 15
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
})

function getTodayCalendarDate() {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    isoDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  }
}

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1)
  const totalDays = new Date(year, month, 0).getDate()
  const firstWeekday = (firstDay.getDay() + 6) % 7
  const cells: Array<{ date: string | null; day: number | null }> = []

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ date: null, day: null })
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      day,
    })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null })
  }

  return cells
}

function createEmptyCalendarDay(date: string): CalendarDayData {
  return {
    date,
    enabled: false,
    slots: [],
  }
}

function createEmptyCalendarSlot(index: number): CalendarDaySlot {
  return {
    id: `new-${index}-${Date.now()}`,
    startTime: '09:00',
    endTime: '10:00',
    enabled: true,
    services: [],
  }
}

function formatCalendarDurationParts(totalMinutes: number) {
  if (totalMinutes <= 0) {
    return {
      primary: '0h',
      secondary: '00m',
    }
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return {
    primary: `${hours}h`,
    secondary: `${minutes.toString().padStart(2, '0')}m`,
  }
}

function summarizeCalendarDay(day: CalendarDayData): CalendarDaySummary {
  const totalMinutes = day.enabled
    ? day.slots
        .filter((slot) => slot.enabled)
        .reduce((total, slot) => {
          const [startHour, startMinute] = slot.startTime.split(':').map((value) => Number(value))
          const [endHour, endMinute] = slot.endTime.split(':').map((value) => Number(value))
          const start = (startHour * 60) + startMinute
          const end = (endHour * 60) + endMinute
          return end > start ? total + (end - start) : total
        }, 0)
    : 0

  const serviceCount = day.enabled
    ? day.slots.reduce((total, slot) => total + slot.services.filter((service) => service.enabled).length, 0)
    : 0

  return {
    date: day.date,
    enabled: day.enabled,
    slotCount: day.enabled ? day.slots.length : 0,
    serviceCount,
    totalMinutes,
  }
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

export default function ProfilePlaceholderPage() {
  const [activeMenu, setActiveMenu] = useState<MenuKey>('personal')
  const [profile, setProfile] = useState<PersonalProfileData>(EMPTY_PROFILE)
  const [operatorProfile, setOperatorProfile] = useState<OperatorProfileData>(EMPTY_OPERATOR_PROFILE)
  const [languages, setLanguages] = useState<LanguageOption[]>([])
  const [operatorTitles, setOperatorTitles] = useState<OperatorTitleOption[]>([])
  const [dogBreeds, setDogBreeds] = useState<DogBreedOption[]>([])
  const [petTypes, setPetTypes] = useState<PetTypeOption[]>([])
  const [houseFeatures, setHouseFeatures] = useState<HouseFeatureOption[]>([])
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isOperatorSaving, setIsOperatorSaving] = useState(false)
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null)
  const [isPhotoPreviewBroken, setIsPhotoPreviewBroken] = useState(false)
  const [cityOptions, setCityOptions] = useState<CityOption[]>([])
  const [isCityLoading, setIsCityLoading] = useState(false)
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false)
  const [isPetTypeDropdownOpen, setIsPetTypeDropdownOpen] = useState(false)
  const [isHouseFeatureDropdownOpen, setIsHouseFeatureDropdownOpen] = useState(false)
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
  const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(null)
  const [draggedGalleryId, setDraggedGalleryId] = useState<string | null>(null)
  const [serviceRateDrafts, setServiceRateDrafts] = useState<Record<number, string>>({})
  const todayCalendar = useMemo(() => getTodayCalendarDate(), [])
  const [calendarYear, setCalendarYear] = useState(todayCalendar.year)
  const [calendarMonth, setCalendarMonth] = useState(todayCalendar.month)
  const [calendarDays, setCalendarDays] = useState<CalendarDaySummary[]>([])
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(todayCalendar.isoDate)
  const [calendarDayData, setCalendarDayData] = useState<CalendarDayData>(createEmptyCalendarDay(todayCalendar.isoDate))
  const [isCalendarEditorOpen, setIsCalendarEditorOpen] = useState(true)
  const [isCalendarMonthLoading, setIsCalendarMonthLoading] = useState(false)
  const [isCalendarDayLoading, setIsCalendarDayLoading] = useState(false)
  const [isCalendarSaving, setIsCalendarSaving] = useState(false)
  const [isCalendarCopying, setIsCalendarCopying] = useState(false)
  const [calendarCopySourceDate, setCalendarCopySourceDate] = useState<string | null>(null)
  const didAttemptInitialGeocodeRef = useRef(false)
  const petTypeDropdownRef = useRef<HTMLDivElement | null>(null)
  const houseFeatureDropdownRef = useRef<HTMLDivElement | null>(null)
  const petTypeTriggerRef = useRef<HTMLButtonElement | null>(null)
  const houseFeatureTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [petTypeTriggerWidth, setPetTypeTriggerWidth] = useState(0)
  const [houseFeatureTriggerWidth, setHouseFeatureTriggerWidth] = useState(0)
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
      profile.languageIds.length > 0,
      sanitizeText(profile.phone) !== '',
      sanitizeText(profile.address) !== '',
      sanitizeText(profile.addressnumber) !== '',
      sanitizeText(operatorProfile.bio) !== '',
      operatorProfile.experienceYears > 0,
      operatorProfile.titleIds.length > 0,
      operatorProfile.dogWeightLimit > 0,
      operatorProfile.breedIds.length > 0,
      operatorProfile.petTypeIds.length > 0,
      operatorProfile.services.length > 0,
      operatorProfile.gallery.length > 0,
    ]

    const completed = checks.filter(Boolean).length
    return Math.round((completed / checks.length) * 100)
  }, [
    profile.address,
    profile.addressnumber,
    profile.age,
    profile.alias,
    profile.city,
    profile.languageIds,
    profile.name,
    profile.phone,
    profile.photoUrl,
    operatorProfile.bio,
    operatorProfile.breedIds,
    operatorProfile.dogWeightLimit,
    operatorProfile.experienceYears,
    operatorProfile.services.length,
    operatorProfile.petTypeIds.length,
    operatorProfile.gallery.length,
    operatorProfile.titleIds,
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
    return alias !== '' ? alias : 'Pet Assistant'
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

  const availableCalendarServices = useMemo(() => {
    const selectedServiceIds = new Set(operatorProfile.services.map((service) => service.serviceId))
    return serviceOptions.filter((service) => selectedServiceIds.has(service.id))
  }, [operatorProfile.services, serviceOptions])

  const calendarMonthLabel = `${CALENDAR_MONTH_LABELS[calendarMonth - 1]} ${calendarYear}`
  const calendarGridCells = useMemo(() => buildMonthGrid(calendarYear, calendarMonth), [calendarYear, calendarMonth])
  const calendarDayMap = useMemo(
    () => Object.fromEntries(calendarDays.map((day) => [day.date, day])),
    [calendarDays]
  )

  const selectedGalleryIndex = useMemo(() => {
    if (!selectedGalleryId) {
      return operatorProfile.gallery.length > 0 ? 0 : -1
    }

    return operatorProfile.gallery.findIndex((item) => item.id === selectedGalleryId)
  }, [operatorProfile.gallery, selectedGalleryId])

  const selectedGalleryItem = selectedGalleryIndex >= 0 ? operatorProfile.gallery[selectedGalleryIndex] : null
  function measureTextWidth(text: string, trigger: HTMLButtonElement | null) {
    if (typeof window === 'undefined') {
      return text.length * 8.4
    }

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) {
      return text.length * 8.4
    }

    const computedStyle = trigger ? window.getComputedStyle(trigger) : null
    context.font = computedStyle?.font || '700 16px system-ui'

    return context.measureText(text).width
  }

  function trimSummaryToWidth(text: string, suffix: string, availableWidth: number, trigger: HTMLButtonElement | null) {
    if (`${text}${suffix}` === suffix) {
      return suffix.trim()
    }

    let compact = text.trim()
    let candidate = `${compact}${suffix}`

    if (measureTextWidth(candidate, trigger) <= availableWidth) {
      return candidate
    }

    while (compact.length > 8) {
      compact = compact.slice(0, -2).trimEnd()
      candidate = `${compact}...${suffix}`

      if (measureTextWidth(candidate, trigger) <= availableWidth) {
        return candidate
      }
    }

    return suffix.trim()
  }

  function buildMultiSelectSummary(
    selectedIds: number[],
    options: Array<{ id: number; name: string }>,
    trigger: HTMLButtonElement | null,
    triggerWidth: number
  ) {
    if (selectedIds.length === 0) {
      return 'Seleziona'
    }

    const selectedNames = options
      .filter((option) => selectedIds.includes(option.id))
      .map((option) => option.name)

    const firstLabel = selectedNames[0] ?? ''

    if (selectedNames.length === 1) {
      return firstLabel
    }

    const availableWidth = Math.max(triggerWidth - 62, 92)
    const fullSummary = selectedNames.join(', ')
    if (measureTextWidth(fullSummary, trigger) <= availableWidth) {
      return fullSummary
    }

    let summary = firstLabel
    let visibleCount = 1

    for (let index = 1; index < selectedNames.length; index += 1) {
      const candidate = `${summary}, ${selectedNames[index]}`
      const remaining = selectedNames.length - (index + 1)
      const suffix = remaining > 0 ? ` +${remaining}` : ''

      if (measureTextWidth(`${candidate}${suffix}`, trigger) > availableWidth) {
        break
      }

      summary = candidate
      visibleCount = index + 1
    }

    const hiddenCount = selectedNames.length - visibleCount
    if (hiddenCount <= 0) {
      return summary
    }

    return trimSummaryToWidth(summary, ` +${hiddenCount}`, availableWidth, trigger)
  }

  const petTypeSummary = useMemo(() => {
    return buildMultiSelectSummary(operatorProfile.petTypeIds, petTypes, petTypeTriggerRef.current, petTypeTriggerWidth)
  }, [operatorProfile.petTypeIds, petTypes, petTypeTriggerWidth])

  const houseFeatureSummary = useMemo(() => {
    return buildMultiSelectSummary(operatorProfile.houseFeatureIds, houseFeatures, houseFeatureTriggerRef.current, houseFeatureTriggerWidth)
  }, [operatorProfile.houseFeatureIds, houseFeatures, houseFeatureTriggerWidth])

  useEffect(() => {
    if (activeMenu !== 'operator' || isLoading || !petTypeTriggerRef.current) {
      return
    }

    const syncWidth = () => {
      if (petTypeTriggerRef.current) {
        setPetTypeTriggerWidth(Math.round(petTypeTriggerRef.current.getBoundingClientRect().width))
      }
    }

    syncWidth()
    window.addEventListener('resize', syncWidth)

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', syncWidth)
      }
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setPetTypeTriggerWidth(Math.round(entry.contentRect.width))
      }
    })

    observer.observe(petTypeTriggerRef.current)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncWidth)
    }
  }, [activeMenu, isLoading, petTypes.length])

  useEffect(() => {
    if (activeMenu !== 'operator' || isLoading || !houseFeatureTriggerRef.current) {
      return
    }

    const syncWidth = () => {
      if (houseFeatureTriggerRef.current) {
        setHouseFeatureTriggerWidth(Math.round(houseFeatureTriggerRef.current.getBoundingClientRect().width))
      }
    }

    syncWidth()
    window.addEventListener('resize', syncWidth)

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', syncWidth)
      }
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setHouseFeatureTriggerWidth(Math.round(entry.contentRect.width))
      }
    })

    observer.observe(houseFeatureTriggerRef.current)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncWidth)
    }
  }, [activeMenu, isLoading, houseFeatures.length])

  useEffect(() => {
    setIsPhotoPreviewBroken(false)
  }, [previewPhotoUrl])

  useEffect(() => {
    if (operatorProfile.gallery.length === 0) {
      if (selectedGalleryId !== null) {
        setSelectedGalleryId(null)
      }
      return
    }

    const hasSelected = selectedGalleryId
      ? operatorProfile.gallery.some((item) => item.id === selectedGalleryId)
      : false

    if (!hasSelected) {
      setSelectedGalleryId(operatorProfile.gallery[0].id)
    }
  }, [operatorProfile.gallery, selectedGalleryId])

  useEffect(() => {
    if (!toastMessage) {
      return
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [toastMessage])

  function showProfileToast(message: string, type: 'error' | 'success') {
    setToastMessage(message)
    setToastType(type)
  }

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
        const [userResponse, profileResponse, languagesResponse, operatorProfileResponse, operatorOptionsResponse] = await Promise.all([
          fetch('/api/auth/me', { headers: { Accept: 'application/json' } }),
          fetch('/api/profile/petassistant/personal', { headers: { Accept: 'application/json' } }),
          fetch('/api/profile/languages', { headers: { Accept: 'application/json' } }),
          fetch('/api/profile/petassistant/operator', { headers: { Accept: 'application/json' } }),
          fetch('/api/profile/operator/options', { headers: { Accept: 'application/json' } }),
        ])

        const userPayload = await userResponse.json().catch(() => ({}))
        const profilePayload = await profileResponse.json().catch(() => ({}))
        const languagesPayload = await languagesResponse.json().catch(() => ({}))
        const operatorProfilePayload = await operatorProfileResponse.json().catch(() => ({}))
        const operatorOptionsPayload = await operatorOptionsResponse.json().catch(() => ({}))

        if (!userResponse.ok || !userPayload?.ok) {
          throw new Error('Sessione utente non disponibile. Effettua una nuova registrazione o autenticazione.')
        }

        if (!profileResponse.ok || !profilePayload?.ok) {
          throw new Error(profilePayload?.message || 'Profilo non disponibile.')
        }

        if (languagesResponse.ok && languagesPayload?.ok && Array.isArray(languagesPayload?.data)) {
          setLanguages(languagesPayload.data)
        }

        if (operatorOptionsResponse.ok && operatorOptionsPayload?.ok) {
          setOperatorTitles(Array.isArray(operatorOptionsPayload?.data?.titles) ? operatorOptionsPayload.data.titles : [])
          setDogBreeds(Array.isArray(operatorOptionsPayload?.data?.breeds) ? operatorOptionsPayload.data.breeds : [])
          setPetTypes(Array.isArray(operatorOptionsPayload?.data?.petTypes) ? operatorOptionsPayload.data.petTypes : [])
          setHouseFeatures(Array.isArray(operatorOptionsPayload?.data?.houseFeatures) ? operatorOptionsPayload.data.houseFeatures : [])
          setServiceOptions(Array.isArray(operatorOptionsPayload?.data?.services) ? operatorOptionsPayload.data.services : [])
        }

        const provider = sanitizeText(userPayload?.data?.user?.provider ?? '').toLowerCase()
        setAuthProvider(provider === 'google' || provider === 'apple' ? provider : '')

        setProfile({
          ...EMPTY_PROFILE,
          ...profilePayload.data,
          alias: sanitizeText(profilePayload?.data?.alias ?? userPayload?.data?.user?.name ?? ''),
          email: sanitizeText(profilePayload?.data?.email ?? userPayload?.data?.user?.email ?? ''),
          languageIds: Array.isArray(profilePayload?.data?.languageIds)
            ? profilePayload.data.languageIds.map((value: number | string) => Number(value)).filter((value: number) => value > 0)
            : [],
        })

        setOperatorProfile({
          ...EMPTY_OPERATOR_PROFILE,
          ...operatorProfilePayload?.data,
          titleIds: Array.isArray(operatorProfilePayload?.data?.titleIds)
            ? operatorProfilePayload.data.titleIds.map((value: number | string) => Number(value)).filter((value: number) => value > 0)
            : [],
          breedIds: Array.isArray(operatorProfilePayload?.data?.breedIds)
            ? operatorProfilePayload.data.breedIds.map((value: number | string) => Number(value)).filter((value: number) => value > 0)
            : [],
          petTypeIds: Array.isArray(operatorProfilePayload?.data?.petTypeIds)
            ? operatorProfilePayload.data.petTypeIds.map((value: number | string) => Number(value)).filter((value: number) => value > 0)
            : [],
          houseFeatureIds: Array.isArray(operatorProfilePayload?.data?.houseFeatureIds)
            ? operatorProfilePayload.data.houseFeatureIds.map((value: number | string) => Number(value)).filter((value: number) => value > 0)
            : [],
          services: Array.isArray(operatorProfilePayload?.data?.services)
            ? operatorProfilePayload.data.services.map((item: Record<string, unknown>) => ({
                serviceId: Number(item.serviceId ?? 0),
                hourlyRate: Number(item.hourlyRate ?? 0),
                featureIds: Array.isArray(item.featureIds)
                  ? item.featureIds.map((value: number | string) => Number(value)).filter((value: number) => value > 0)
                  : [],
              })).filter((item: OperatorServiceSelection) => item.serviceId > 0)
            : [],
          gallery: Array.isArray(operatorProfilePayload?.data?.gallery)
            ? operatorProfilePayload.data.gallery.map((item: Record<string, unknown>, index: number) => ({
                id: sanitizeText(item.id ?? `existing-${index}`) || `existing-${index}`,
                photo: sanitizeText(item.photo ?? ''),
                photoUrl: sanitizeText(item.photoUrl ?? ''),
                caption: sanitizeText(item.caption ?? ''),
                file: null,
              }))
            : [],
        })
        setServiceRateDrafts(
          Array.isArray(operatorProfilePayload?.data?.services)
            ? Object.fromEntries(
                operatorProfilePayload.data.services
                  .map((item: Record<string, unknown>) => [Number(item.serviceId ?? 0), Number(item.hourlyRate ?? 0) > 0 ? String(item.hourlyRate) : ''])
                  .filter((entry: [number, string]) => entry[0] > 0)
              )
            : {}
        )
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
    if (activeMenu !== 'calendar') {
      return
    }

    void loadCalendarMonth(calendarYear, calendarMonth)
  }, [activeMenu, calendarYear, calendarMonth])

  useEffect(() => {
    if (activeMenu !== 'calendar' || !isCalendarEditorOpen || sanitizeText(selectedCalendarDate) === '') {
      return
    }

    void loadCalendarDay(selectedCalendarDate)
  }, [activeMenu, isCalendarEditorOpen, selectedCalendarDate])

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

  useEffect(() => {
    if (!isPetTypeDropdownOpen) {
      return
    }

    function handleOutsideClick(event: MouseEvent) {
      if (!petTypeDropdownRef.current) {
        return
      }

      if (!petTypeDropdownRef.current.contains(event.target as Node)) {
        setIsPetTypeDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isPetTypeDropdownOpen])

  useEffect(() => {
    if (!isHouseFeatureDropdownOpen) {
      return
    }

    function handleOutsideClick(event: MouseEvent) {
      if (!houseFeatureDropdownRef.current) {
        return
      }

      if (!houseFeatureDropdownRef.current.contains(event.target as Node)) {
        setIsHouseFeatureDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isHouseFeatureDropdownOpen])

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

  function toggleLanguage(languageId: number) {
    setProfile((current) => {
      const alreadySelected = current.languageIds.includes(languageId)
      return {
        ...current,
        languageIds: alreadySelected
          ? current.languageIds.filter((id) => id !== languageId)
          : [...current.languageIds, languageId],
      }
    })
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setSelectedPhotoFile(file)
  }

  function updateOperatorField<K extends keyof OperatorProfileData>(field: K, value: OperatorProfileData[K]) {
    setOperatorProfile((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function toggleOperatorSelection(field: 'titleIds' | 'breedIds' | 'petTypeIds' | 'houseFeatureIds', id: number) {
    setOperatorProfile((current) => {
      const values = current[field]
      const alreadySelected = values.includes(id)
      return {
        ...current,
        [field]: alreadySelected ? values.filter((value) => value !== id) : [...values, id],
      }
    })
  }

  function isServiceSelected(serviceId: number) {
    return operatorProfile.services.some((service) => service.serviceId === serviceId)
  }

  function toggleOperatorService(serviceId: number) {
    setOperatorProfile((current) => {
      const exists = current.services.some((service) => service.serviceId === serviceId)
      const option = serviceOptions.find((service) => service.id === serviceId)
      setServiceRateDrafts((drafts) => {
        if (exists) {
          const nextDrafts = { ...drafts }
          delete nextDrafts[serviceId]
          return nextDrafts
        }

        return {
          ...drafts,
          [serviceId]: '',
        }
      })
      return {
        ...current,
        services: exists
          ? current.services.filter((service) => service.serviceId !== serviceId)
          : [...current.services, { serviceId, featureIds: (option?.features ?? []).map((feature) => feature.id), hourlyRate: 0 }],
      }
    })
  }

  function updateOperatorServiceHourlyRate(serviceId: number, rawValue: string) {
    const normalizedValue = rawValue.replace(',', '.').replace(/[^\d.]/g, '')
    const decimalParts = normalizedValue.split('.')
    const integerPart = decimalParts[0] ?? ''
    const decimalPart = decimalParts[1] ?? ''
    const safeValue = decimalParts.length > 1
      ? `${integerPart}.${decimalPart.slice(0, 2)}`
      : integerPart
    const parsedValue = safeValue !== '' && safeValue !== '.' ? Number(safeValue) : 0

    setServiceRateDrafts((current) => ({
      ...current,
      [serviceId]: rawValue,
    }))

    setOperatorProfile((current) => ({
      ...current,
      services: current.services.map((service) => (
        service.serviceId === serviceId
          ? {
              ...service,
              hourlyRate: Number.isFinite(parsedValue) ? parsedValue : 0,
            }
          : service
      )),
    }))
  }

  function toggleOperatorServiceFeature(serviceId: number, featureId: number) {
    setOperatorProfile((current) => ({
      ...current,
      services: current.services.map((service) => (
        service.serviceId === serviceId
          ? {
              ...service,
              featureIds: service.featureIds.includes(featureId)
                ? service.featureIds.filter((id) => id !== featureId)
                : [...service.featureIds, featureId],
            }
          : service
      )),
    }))
  }

  async function loadCalendarMonth(year = calendarYear, month = calendarMonth) {
    setIsCalendarMonthLoading(true)

    try {
      const response = await fetch(`/api/profile/petassistant/calendar?year=${year}&month=${month}`, {
        headers: { Accept: 'application/json' },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Caricamento calendario non completato.')
      }

      setCalendarDays(Array.isArray(payload?.data?.days) ? payload.data.days : [])
    } catch {
      setCalendarDays([])
    } finally {
      setIsCalendarMonthLoading(false)
    }
  }

  async function loadCalendarDay(date: string) {
    setIsCalendarDayLoading(true)

    try {
      const response = await fetch(`/api/profile/petassistant/calendar/day?date=${encodeURIComponent(date)}`, {
        headers: { Accept: 'application/json' },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Caricamento giornata non completato.')
      }

      setCalendarDayData({
        date,
        enabled: Boolean(payload?.data?.enabled),
        slots: Array.isArray(payload?.data?.slots)
          ? payload.data.slots.map((slot: Record<string, unknown>, index: number) => ({
              id: slot.id ?? `slot-${index}`,
              startTime: sanitizeText(String(slot.startTime ?? '09:00')) || '09:00',
              endTime: sanitizeText(String(slot.endTime ?? '10:00')) || '10:00',
              enabled: Boolean(slot.enabled),
              services: Array.isArray(slot.services)
                ? slot.services.map((service: Record<string, unknown>) => ({
                    serviceId: Number(service.serviceId ?? 0),
                    enabled: Boolean(service.enabled),
                    hourlyRate: Number(service.hourlyRate ?? 0),
                  })).filter((service: CalendarSlotServiceSelection) => service.serviceId > 0)
                : [],
            }))
          : [],
      })
    } catch {
      setCalendarDayData(createEmptyCalendarDay(date))
    } finally {
      setIsCalendarDayLoading(false)
    }
  }

  function shiftCalendarMonth(delta: number) {
    const nextDate = new Date(calendarYear, calendarMonth - 1 + delta, 1)
    const nextYear = nextDate.getFullYear()
    const nextMonth = nextDate.getMonth() + 1
    const nextSelectedDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
    setCalendarYear(nextYear)
    setCalendarMonth(nextMonth)
    setSelectedCalendarDate(nextSelectedDate)
  }

  function updateCalendarDayField<K extends keyof CalendarDayData>(field: K, value: CalendarDayData[K]) {
    setCalendarDayData((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function addCalendarSlot() {
    setCalendarDayData((current) => ({
      ...current,
      slots: [...current.slots, createEmptyCalendarSlot(current.slots.length + 1)],
    }))
  }

  function updateCalendarSlot(index: number, field: keyof CalendarDaySlot, value: string | boolean | CalendarSlotServiceSelection[]) {
    setCalendarDayData((current) => ({
      ...current,
      slots: current.slots.map((slot, slotIndex) => (
        slotIndex === index
          ? {
              ...slot,
              [field]: value,
            }
          : slot
      )),
    }))
  }

  function removeCalendarSlot(index: number) {
    setCalendarDayData((current) => ({
      ...current,
      slots: current.slots.filter((_, slotIndex) => slotIndex !== index),
    }))
  }

  function toggleCalendarSlotService(slotIndex: number, serviceId: number) {
    setCalendarDayData((current) => ({
      ...current,
      slots: current.slots.map((slot, currentIndex) => {
        if (currentIndex !== slotIndex) {
          return slot
        }

        const exists = slot.services.some((service) => service.serviceId === serviceId)
        const defaultHourlyRate = operatorProfile.services.find((service) => service.serviceId === serviceId)?.hourlyRate ?? 0

        return {
          ...slot,
          services: exists
            ? slot.services.filter((service) => service.serviceId !== serviceId)
            : [...slot.services, { serviceId, enabled: true, hourlyRate: defaultHourlyRate }],
        }
      }),
    }))
  }

  function updateCalendarSlotServiceRate(slotIndex: number, serviceId: number, rawValue: string) {
    const normalizedValue = rawValue.replace(',', '.').replace(/[^\d.]/g, '')
    const decimalParts = normalizedValue.split('.')
    const safeValue = decimalParts.length > 1
      ? `${decimalParts[0]}.${(decimalParts[1] ?? '').slice(0, 2)}`
      : decimalParts[0] ?? ''
    const parsedValue = safeValue !== '' && safeValue !== '.' ? Number(safeValue) : 0

    setCalendarDayData((current) => ({
      ...current,
      slots: current.slots.map((slot, currentIndex) => (
        currentIndex === slotIndex
          ? {
              ...slot,
              services: slot.services.map((service) => (
                service.serviceId === serviceId
                  ? { ...service, hourlyRate: Number.isFinite(parsedValue) ? parsedValue : 0 }
                  : service
              )),
            }
          : slot
      )),
    }))
  }

  function exitCalendarEditor() {
    setIsCalendarEditorOpen(false)
    setCalendarCopySourceDate(null)
  }

  async function persistCalendarDay(showSuccessToast = true) {
    if (calendarDayData.slots.some((slot) => sanitizeText(slot.startTime) === '' || sanitizeText(slot.endTime) === '')) {
      showProfileToast('Ogni fascia deve avere orario inizio e fine.', 'error')
      return false
    }

    if (calendarDayData.slots.some((slot) => slot.enabled && slot.services.length === 0)) {
      showProfileToast('Seleziona almeno un servizio per ogni fascia attiva prima di salvare.', 'error')
      return false
    }

    setIsCalendarSaving(true)

    try {
      const response = await fetch('/api/profile/petassistant/calendar/day', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(calendarDayData),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Salvataggio calendario non completato.')
      }

      setCalendarDayData({
        date: calendarDayData.date,
        enabled: Boolean(payload?.data?.enabled),
        slots: Array.isArray(payload?.data?.slots)
          ? payload.data.slots.map((slot: Record<string, unknown>, index: number) => ({
              id: slot.id ?? `slot-${index}`,
              startTime: sanitizeText(String(slot.startTime ?? '09:00')) || '09:00',
              endTime: sanitizeText(String(slot.endTime ?? '10:00')) || '10:00',
              enabled: Boolean(slot.enabled),
              services: Array.isArray(slot.services)
                ? slot.services.map((service: Record<string, unknown>) => ({
                    serviceId: Number(service.serviceId ?? 0),
                    enabled: Boolean(service.enabled),
                    hourlyRate: Number(service.hourlyRate ?? 0),
                  })).filter((service: CalendarSlotServiceSelection) => service.serviceId > 0)
                : [],
            }))
          : [],
      })
      setCalendarDays((current) => {
        const nextSummary = summarizeCalendarDay({
          date: calendarDayData.date,
          enabled: Boolean(payload?.data?.enabled),
          slots: Array.isArray(payload?.data?.slots)
            ? payload.data.slots.map((slot: Record<string, unknown>, index: number) => ({
                id: slot.id ?? `slot-${index}`,
                startTime: sanitizeText(String(slot.startTime ?? '09:00')) || '09:00',
                endTime: sanitizeText(String(slot.endTime ?? '10:00')) || '10:00',
                enabled: Boolean(slot.enabled),
                services: Array.isArray(slot.services)
                  ? slot.services.map((service: Record<string, unknown>) => ({
                      serviceId: Number(service.serviceId ?? 0),
                      enabled: Boolean(service.enabled),
                      hourlyRate: Number(service.hourlyRate ?? 0),
                    })).filter((service: CalendarSlotServiceSelection) => service.serviceId > 0)
                  : [],
              }))
            : [],
        })

        return current.map((day) => (day.date === nextSummary.date ? nextSummary : day))
      })
      await loadCalendarMonth()
      if (showSuccessToast) {
        showProfileToast(payload?.message || 'Disponibilita calendario salvata con successo.', 'success')
      }
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Salvataggio calendario non completato.'
      showProfileToast(message, 'error')
      return false
    } finally {
      setIsCalendarSaving(false)
    }
  }

  async function saveCalendarDay() {
    await persistCalendarDay(true)
  }

  async function enableCalendarCopyMode() {
    const saved = await persistCalendarDay(false)
    if (!saved) {
      return
    }

    setCalendarCopySourceDate(selectedCalendarDate)
    setIsCalendarEditorOpen(false)
    showProfileToast(`Modalita copia attiva dal giorno ${selectedCalendarDate}. Clicca i giorni di calendario per applicarla.`, 'success')
  }

  async function copyCalendarDayToTarget(targetDate: string) {
    if (calendarCopySourceDate === null || targetDate === calendarCopySourceDate) {
      return
    }

    setIsCalendarCopying(true)

    try {
      const response = await fetch('/api/profile/petassistant/calendar/copy', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceDate: calendarCopySourceDate,
          targetDates: [targetDate],
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Copia calendario non completata.')
      }

      await loadCalendarMonth()
      showProfileToast(`Configurazione copiata sul giorno ${targetDate}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Copia calendario non completata.'
      showProfileToast(message, 'error')
    } finally {
      setIsCalendarCopying(false)
    }
  }

  function handleCalendarCellClick(date: string) {
    if (calendarCopySourceDate !== null) {
      void copyCalendarDayToTarget(date)
      return
    }

    setSelectedCalendarDate(date)
    setIsCalendarEditorOpen(true)
  }

  function handleOperatorGalleryChange(index: number, field: 'caption' | 'file', value: string | File | null) {
    setOperatorProfile((current) => ({
      ...current,
      gallery: current.gallery.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item
        }

        if (field === 'caption') {
          return {
            ...item,
            caption: typeof value === 'string' ? value : item.caption,
          }
        }

        const file = value instanceof File ? value : null
        return {
          ...item,
          file,
          photo: file ? '' : item.photo,
          photoUrl: file ? URL.createObjectURL(file) : item.photoUrl,
        }
      }),
    }))
  }

  function addOperatorGalleryItem() {
    const newId = `new-${Date.now()}-${operatorProfile.gallery.length}`

    setOperatorProfile((current) => ({
      ...current,
      gallery: [
        ...current.gallery,
        {
          id: newId,
          photo: '',
          photoUrl: '',
          caption: '',
          file: null,
        },
      ],
    }))
    setSelectedGalleryId(newId)
  }

  function removeOperatorGalleryItem(index: number) {
    const nextGallery = operatorProfile.gallery.filter((_, itemIndex) => itemIndex !== index)
    const removedItem = operatorProfile.gallery[index]

    setOperatorProfile((current) => ({
      ...current,
      gallery: current.gallery.filter((_, itemIndex) => itemIndex !== index),
    }))

    if (removedItem && removedItem.id === selectedGalleryId) {
      const fallbackItem = nextGallery[Math.min(index, nextGallery.length - 1)] ?? null
      setSelectedGalleryId(fallbackItem ? fallbackItem.id : null)
    }
  }

  function reorderOperatorGallery(sourceId: string, targetId: string) {
    if (!sourceId || !targetId || sourceId === targetId) {
      return
    }

    setOperatorProfile((current) => {
      const sourceIndex = current.gallery.findIndex((item) => item.id === sourceId)
      const targetIndex = current.gallery.findIndex((item) => item.id === targetId)

      if (sourceIndex < 0 || targetIndex < 0) {
        return current
      }

      const nextGallery = [...current.gallery]
      const [movedItem] = nextGallery.splice(sourceIndex, 1)
      nextGallery.splice(targetIndex, 0, movedItem)

      return {
        ...current,
        gallery: nextGallery,
      }
    })
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
    profile.languageIds.forEach((languageId) => {
      body.append('languageIds[]', String(languageId))
    })

    if (selectedPhotoFile) {
      body.append('photo', selectedPhotoFile)
    }

    setIsSaving(true)

    try {
      const response = await fetch('/api/profile/petassistant/personal', {
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
      const response = await fetch('/api/profile/petassistant/password', {
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

  async function handleSaveOperatorData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const body = new FormData()
    if (sanitizeText(operatorProfile.bio) !== '') {
      body.append('bio', sanitizeText(operatorProfile.bio))
    }
    if (operatorProfile.experienceYears > 0) {
      body.append('experienceYears', String(operatorProfile.experienceYears))
    }
    if (operatorProfile.dogWeightLimit > 0) {
      body.append('dogWeightLimit', String(operatorProfile.dogWeightLimit))
    }

    operatorProfile.titleIds.forEach((titleId) => {
      body.append('titleIds[]', String(titleId))
    })
    operatorProfile.breedIds.forEach((breedId) => {
      body.append('breedIds[]', String(breedId))
    })
    operatorProfile.petTypeIds.forEach((petTypeId) => {
      body.append('petTypeIds[]', String(petTypeId))
    })
    operatorProfile.houseFeatureIds.forEach((houseFeatureId) => {
      body.append('houseFeatureIds[]', String(houseFeatureId))
    })
    operatorProfile.services.forEach((service, index) => {
      body.append(`services[${index}][serviceId]`, String(service.serviceId))
      if (service.hourlyRate > 0) {
        body.append(`services[${index}][hourlyRate]`, String(service.hourlyRate))
      }
      service.featureIds.forEach((featureId, featureIndex) => {
        body.append(`services[${index}][featureIds][${featureIndex}]`, String(featureId))
      })
    })

    const existingGallery: Array<{ photo: string; caption: string }> = []
    const newGalleryItems = operatorProfile.gallery.filter((item) => item.file || sanitizeText(item.photo) !== '')
    newGalleryItems.forEach((item, index) => {
      body.append(`gallery[${index}][caption]`, sanitizeText(item.caption))
      if (item.file) {
        body.append(`galleryPhotos[${index}]`, item.file)
      } else if (sanitizeText(item.photo) !== '') {
        existingGallery.push({
          photo: sanitizeText(item.photo),
          caption: sanitizeText(item.caption),
        })
      }
    })

    existingGallery.forEach((item, index) => {
      body.append(`existingGallery[${index}][photo]`, item.photo)
      body.append(`existingGallery[${index}][caption]`, item.caption)
    })

    setIsOperatorSaving(true)

    try {
      const response = await fetch('/api/profile/petassistant/operator', {
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

      setOperatorProfile({
        ...EMPTY_OPERATOR_PROFILE,
        ...payload.data,
        titleIds: Array.isArray(payload?.data?.titleIds) ? payload.data.titleIds.map((value: number | string) => Number(value)).filter((value: number) => value > 0) : [],
        breedIds: Array.isArray(payload?.data?.breedIds) ? payload.data.breedIds.map((value: number | string) => Number(value)).filter((value: number) => value > 0) : [],
        services: Array.isArray(payload?.data?.services)
          ? payload.data.services.map((item: Record<string, unknown>) => ({
              serviceId: Number(item.serviceId ?? 0),
              hourlyRate: Number(item.hourlyRate ?? 0),
              featureIds: Array.isArray(item.featureIds)
                ? item.featureIds.map((value: number | string) => Number(value)).filter((value: number) => value > 0)
                : [],
            })).filter((item: OperatorServiceSelection) => item.serviceId > 0)
          : [],
        petTypeIds: Array.isArray(payload?.data?.petTypeIds)
          ? payload.data.petTypeIds.map((value: number | string) => Number(value)).filter((value: number) => value > 0)
          : [],
        houseFeatureIds: Array.isArray(payload?.data?.houseFeatureIds)
          ? payload.data.houseFeatureIds.map((value: number | string) => Number(value)).filter((value: number) => value > 0)
          : [],
        gallery: Array.isArray(payload?.data?.gallery)
          ? payload.data.gallery.map((item: Record<string, unknown>, index: number) => ({
              id: sanitizeText(item.id ?? `saved-${index}`) || `saved-${index}`,
              photo: sanitizeText(item.photo ?? ''),
              photoUrl: sanitizeText(item.photoUrl ?? ''),
              caption: sanitizeText(item.caption ?? ''),
              file: null,
            }))
          : [],
      })
      setServiceRateDrafts(
        Array.isArray(payload?.data?.services)
          ? Object.fromEntries(
              payload.data.services
                .map((item: Record<string, unknown>) => [Number(item.serviceId ?? 0), Number(item.hourlyRate ?? 0) > 0 ? String(item.hourlyRate) : ''])
                .filter((entry: [number, string]) => entry[0] > 0)
            )
          : {}
      )
      showProfileToast(payload?.message || 'Dati operatore salvati con successo.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Salvataggio non completato.'
      showProfileToast(message, 'error')
    } finally {
      setIsOperatorSaving(false)
    }
  }

  return (
    <main className="register-shell">
      <section className="register-hero profile-shell-panel" aria-label="Profilo Pet Assistant">
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

        <section className="profile-layout" aria-label="Layout interno profilo">
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
                className={`profile-menu-item is-operator ${activeMenu === 'operator' ? 'is-active' : ''}`}
                type="button"
                onClick={() => setActiveMenu('operator')}
              >
                <span className="profile-menu-badge" aria-hidden="true">
                  <OperatorDataIcon />
                </span>
                <span className="profile-menu-copy">
                  <strong>DATI OPERATORE</strong>
                  <small>Competenze, servizi e presentazione professionale</small>
                </span>
              </button>
              <button
                className={`profile-menu-item is-calendar ${activeMenu === 'calendar' ? 'is-active' : ''}`}
                type="button"
                onClick={() => setActiveMenu('calendar')}
              >
                <span className="profile-menu-badge" aria-hidden="true">
                  <CalendarIcon />
                </span>
                <span className="profile-menu-copy">
                  <strong>CALENDARIO</strong>
                  <small>Disponibilita, turni e organizzazione delle attivita</small>
                </span>
              </button>
            </nav>
          </aside>

          <section className="profile-stage" aria-label="Contenuto pagina">
            <div className="profile-stage-card">
              {activeMenu === 'personal' ? (
                <>
                  <p className="profile-stage-kicker">PROFILO PET ASSISTANT</p>
                  <div className="profile-stage-title-row">
                    <h1 className="profile-stage-title">Dati personali</h1>
                    <FieldLegend />
                  </div>

                  {isLoading ? (
                    <div className="profile-loading-card">Caricamento dati personali in corso...</div>
                  ) : (
                    <form id="profile-personal-form" className="profile-form" onSubmit={handleSavePersonalData}>
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
                            list="profile-age-options"
                            value={profile.age ? String(profile.age) : ''}
                            placeholder="Seleziona"
                            inputMode="numeric"
                            onChange={(event) => {
                              const rawValue = event.target.value.replace(/[^\d]/g, '')
                              updateProfileField('age', rawValue ? Number(rawValue) : 0)
                            }}
                          />
                          <datalist id="profile-age-options">
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
                            L'indirizzo sar&agrave; mostrato solo ai clienti che effettuano una richiesta di assistenza.
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
                                  list="profile-address-suggestions"
                                  value={profile.address}
                                  onChange={(event) => updateProfileField('address', event.target.value)}
                                />
                                <datalist id="profile-address-suggestions">
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
                      <section className="profile-form-section">
                        <div className="profile-location-copy">
                          <p className="profile-location-kicker">LINGUE PARLATE</p>
                        </div>
                        <div className="profile-field">
                          <div className="profile-language-grid">
                            {languages.map((language) => (
                              <label key={language.id} className="profile-language-option">
                                <input
                                  type="checkbox"
                                  checked={profile.languageIds.includes(language.id)}
                                  onChange={() => toggleLanguage(language.id)}
                                />
                                <span>{language.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </section>
                    </form>
                  )}
                </>
              ) : activeMenu === 'operator' ? (
                <>
                  <p className="profile-stage-kicker">PROFILO PET ASSISTANT</p>
                  <h1 className="profile-stage-title">Dati operatore</h1>

                  {isLoading ? (
                    <div className="profile-loading-card">Caricamento dati operatore in corso...</div>
                  ) : (
                    <form id="profile-operator-form" className="profile-form" onSubmit={handleSaveOperatorData}>
                      <section className="profile-form-section">
                        <label className="profile-field">
                          <span>Presentazione (bio)</span>
                          <textarea
                            className="profile-textarea"
                            rows={6}
                            value={operatorProfile.bio}
                            onChange={(event) => updateOperatorField('bio', event.target.value)}
                          />
                        </label>
                      </section>

                      <section className="profile-form-grid profile-form-grid-operator-three profile-form-section">
                        <label className="profile-field">
                          <span>Anni esperienza</span>
                          <input
                            type="text"
                            list="profile-experience-options"
                            value={operatorProfile.experienceYears ? String(operatorProfile.experienceYears) : ''}
                            placeholder="Seleziona"
                            inputMode="numeric"
                            onChange={(event) => {
                              const rawValue = event.target.value.replace(/[^\d]/g, '')
                              updateOperatorField('experienceYears', rawValue ? Number(rawValue) : 0)
                            }}
                          />
                          <datalist id="profile-experience-options">
                            {EXPERIENCE_OPTIONS.map((years) => (
                              <option key={years} value={String(years)} />
                            ))}
                          </datalist>
                        </label>
                        <label className="profile-field">
                          <span>Limite peso pet (kg)</span>
                          <input
                            type="text"
                            list="profile-weight-options"
                            value={operatorProfile.dogWeightLimit ? String(operatorProfile.dogWeightLimit) : ''}
                            placeholder="Seleziona"
                            inputMode="numeric"
                            onChange={(event) => {
                              const rawValue = event.target.value.replace(/[^\d]/g, '')
                              updateOperatorField('dogWeightLimit', rawValue ? Number(rawValue) : 0)
                            }}
                          />
                          <datalist id="profile-weight-options">
                            {DOG_WEIGHT_OPTIONS.map((weight) => (
                              <option key={weight} value={String(weight)} />
                            ))}
                          </datalist>
                        </label>
                        <div className="profile-field profile-multiselect-field" ref={petTypeDropdownRef}>
                          <span>Tipo di pet</span>
                          <button
                            type="button"
                            className={`profile-multiselect-trigger ${isPetTypeDropdownOpen ? 'is-open' : ''}`}
                            ref={petTypeTriggerRef}
                            onClick={() => setIsPetTypeDropdownOpen((current) => !current)}
                            aria-haspopup="listbox"
                            aria-expanded={isPetTypeDropdownOpen}
                          >
                            <span className={`profile-multiselect-value ${operatorProfile.petTypeIds.length > 0 ? 'is-selected' : ''}`}>
                              {petTypeSummary}
                            </span>
                          </button>
                          {isPetTypeDropdownOpen ? (
                            <div className="profile-city-dropdown profile-multiselect-dropdown" role="listbox" aria-multiselectable="true">
                              {petTypes.length > 0 ? (
                                petTypes.map((petType) => (
                                  <label key={petType.id} className="profile-multiselect-option">
                                    <input
                                      type="checkbox"
                                      checked={operatorProfile.petTypeIds.includes(petType.id)}
                                      onChange={() => toggleOperatorSelection('petTypeIds', petType.id)}
                                    />
                                    <span>{petType.name}</span>
                                  </label>
                                ))
                              ) : (
                                <div className="profile-city-state">Nessuna tipologia disponibile.</div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </section>

                      <section className="profile-form-section">
                        <div className="profile-location-copy">
                          <p className="profile-location-kicker">ELENCO TITOLI</p>
                          <p className="profile-location-text">
                            Seleziona uno o più ruoli professionali che rappresentano la tua attività.
                          </p>
                        </div>
                        <div className="profile-field">
                          <div className="profile-language-grid">
                            {operatorTitles.map((title) => (
                              <label key={title.id} className="profile-language-option">
                                <input
                                  type="checkbox"
                                  checked={operatorProfile.titleIds.includes(title.id)}
                                  onChange={() => toggleOperatorSelection('titleIds', title.id)}
                                />
                                <span>{title.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </section>

                      <section className="profile-form-section">
                        <div className="profile-location-copy">
                          <p className="profile-location-kicker">ELENCO RAZZE</p>
                          <p className="profile-location-text">
                            Indica le razze con cui puoi lavorare, aggiornabili nel tempo anche da sezione admin.
                          </p>
                        </div>
                        <div className="profile-field">
                          <div className="profile-language-grid">
                            {dogBreeds.map((breed) => (
                              <label key={breed.id} className="profile-language-option">
                                <input
                                  type="checkbox"
                                  checked={operatorProfile.breedIds.includes(breed.id)}
                                  onChange={() => toggleOperatorSelection('breedIds', breed.id)}
                                />
                                <span>{breed.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </section>

                      <section className="profile-form-section">
                        <div className="profile-location-copy">
                          <p className="profile-location-kicker">SERVIZI</p>
                          <p className="profile-location-text">
                            Seleziona i servizi disponibili dal CRM e, per ciascuno, indica se puo essere svolto in esclusiva.
                          </p>
                        </div>
                        <div className="profile-services-grid">
                          {serviceOptions.map((service) => {
                            const selected = isServiceSelected(service.id)
                            const currentSelection = operatorProfile.services.find((item) => item.serviceId === service.id)

                            return (
                              <article key={service.id} className={`profile-service-card ${selected ? 'is-selected' : ''}`}>
                                <label className="profile-service-head">
                                  <span className="profile-service-checkbox">
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => toggleOperatorService(service.id)}
                                    />
                                  </span>
                                  <span className="profile-service-copy">
                                    <strong>{service.name}</strong>
                                    <small>{service.description}</small>
                                  </span>
                                </label>

                                <div className="profile-service-features">
                                  {service.features.map((feature) => (
                                    <button
                                      key={`${service.id}-${feature.id}`}
                                      type="button"
                                      className={`profile-service-feature ${selected && currentSelection?.featureIds.includes(feature.id) ? 'is-active' : 'is-inactive'}`}
                                      disabled={!selected}
                                      onClick={() => toggleOperatorServiceFeature(service.id, feature.id)}
                                    >
                                      {feature.name}
                                    </button>
                                  ))}
                                </div>
                                {selected ? (
                                  <label className="profile-field profile-service-rate">
                                    <span>Prezzo orario (EUR)</span>
                                    <input
                                      type="text"
                                      value={serviceRateDrafts[service.id] ?? (currentSelection?.hourlyRate ? String(currentSelection.hourlyRate) : '')}
                                      placeholder="Es. 15.00"
                                      inputMode="decimal"
                                      onChange={(event) => {
                                        updateOperatorServiceHourlyRate(service.id, event.target.value)
                                      }}
                                    />
                                  </label>
                                ) : null}
                              </article>
                            )
                          })}
                        </div>
                      </section>

                      <section className="profile-form-section">
                        <div className="profile-location-copy">
                          <p className="profile-location-kicker">CARATTERISTICHE CASA</p>
                          <p className="profile-location-text">
                            Seleziona le caratteristiche dell'ambiente domestico che descrivono al meglio lo spazio disponibile.
                          </p>
                        </div>
                        <div className="profile-field profile-multiselect-field" ref={houseFeatureDropdownRef}>
                          <button
                            type="button"
                            className={`profile-multiselect-trigger ${isHouseFeatureDropdownOpen ? 'is-open' : ''}`}
                            ref={houseFeatureTriggerRef}
                            onClick={() => setIsHouseFeatureDropdownOpen((current) => !current)}
                            aria-haspopup="listbox"
                            aria-expanded={isHouseFeatureDropdownOpen}
                          >
                            <span className={`profile-multiselect-value ${operatorProfile.houseFeatureIds.length > 0 ? 'is-selected' : ''}`}>
                              {houseFeatureSummary}
                            </span>
                          </button>
                          {isHouseFeatureDropdownOpen ? (
                            <div className="profile-city-dropdown profile-multiselect-dropdown" role="listbox" aria-multiselectable="true">
                              {houseFeatures.length > 0 ? (
                                houseFeatures.map((houseFeature) => (
                                  <label key={houseFeature.id} className="profile-multiselect-option">
                                    <input
                                      type="checkbox"
                                      checked={operatorProfile.houseFeatureIds.includes(houseFeature.id)}
                                      onChange={() => toggleOperatorSelection('houseFeatureIds', houseFeature.id)}
                                    />
                                    <span>{houseFeature.name}</span>
                                  </label>
                                ))
                              ) : (
                                <div className="profile-city-state">Nessuna caratteristica disponibile.</div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </section>

                      <section className="profile-form-section">
                        <div className="profile-gallery-header">
                          <div className="profile-location-copy">
                            <p className="profile-location-kicker">GALLERY FOTO CASA</p>
                            <p className="profile-location-text">
                              Carica immagini degli ambienti e abbina a ciascuna foto una breve descrizione.
                            </p>
                          </div>
                          <button type="button" className="profile-gallery-add" onClick={addOperatorGalleryItem}>
                            + Aggiungi
                          </button>
                        </div>
                        <div className="profile-gallery-layout">
                          <div className="profile-gallery-thumbs">
                            {operatorProfile.gallery.length > 0 ? (
                              operatorProfile.gallery.map((item, index) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  className={`profile-gallery-thumb ${selectedGalleryItem?.id === item.id ? 'is-active' : ''} ${draggedGalleryId === item.id ? 'is-dragging' : ''}`}
                                  onClick={() => setSelectedGalleryId(item.id)}
                                  draggable
                                  onDragStart={() => setDraggedGalleryId(item.id)}
                                  onDragEnd={() => setDraggedGalleryId(null)}
                                  onDragOver={(event) => {
                                    event.preventDefault()
                                  }}
                                  onDrop={(event) => {
                                    event.preventDefault()
                                    reorderOperatorGallery(draggedGalleryId ?? '', item.id)
                                    setDraggedGalleryId(null)
                                  }}
                                >
                                  <span className="profile-gallery-thumb-order">{index + 1}</span>
                                  <div className="profile-gallery-thumb-frame">
                                    {item.photoUrl ? (
                                      <img
                                        src={item.photoUrl}
                                        alt={`Gallery casa ${index + 1}`}
                                        className="profile-gallery-image"
                                      />
                                    ) : (
                                      <span className="profile-photo-placeholder">Anteprima foto</span>
                                    )}
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="profile-gallery-empty">
                                Nessuna foto presente. Usa il pulsante Aggiungi per iniziare.
                              </div>
                            )}
                          </div>

                          <div className="profile-gallery-editor">
                            {selectedGalleryItem ? (
                              <>
                                <div className="profile-gallery-card">
                                  <div className="profile-gallery-frame">
                                    {selectedGalleryItem.photoUrl ? (
                                      <img
                                        src={selectedGalleryItem.photoUrl}
                                        alt={`Gallery casa ${selectedGalleryIndex + 1}`}
                                        className="profile-gallery-image"
                                      />
                                    ) : (
                                      <span className="profile-photo-placeholder">Anteprima foto</span>
                                    )}
                                  </div>
                                  <div className="profile-gallery-editor-note">
                                    Stai modificando la foto in posizione <strong>{selectedGalleryIndex + 1}</strong>.
                                  </div>
                                  <label className="profile-upload-button profile-upload-button-secondary">
                                    Carica foto
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(event) =>
                                        handleOperatorGalleryChange(
                                          selectedGalleryIndex,
                                          'file',
                                          event.target.files?.[0] ?? null
                                        )
                                      }
                                    />
                                  </label>
                                  <label className="profile-field">
                                    <span>Testo foto</span>
                                    <textarea
                                      className="profile-textarea profile-textarea-compact"
                                      rows={3}
                                      value={selectedGalleryItem.caption}
                                      onChange={(event) =>
                                        handleOperatorGalleryChange(selectedGalleryIndex, 'caption', event.target.value)
                                      }
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    className="profile-gallery-remove"
                                    onClick={() => removeOperatorGalleryItem(selectedGalleryIndex)}
                                  >
                                    Rimuovi foto
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="profile-gallery-empty profile-gallery-empty-editor">
                                Seleziona o aggiungi una foto per modificarne immagine e descrizione.
                              </div>
                            )}
                          </div>
                        </div>
                      </section>

                    </form>
                  )}
                </>
              ) : (
                <>
                  <p className="profile-stage-kicker">DISPONIBILITA PRENOTABILE</p>
                  <h1 className="profile-stage-title">Calendario</h1>
                  <div className="profile-calendar-shell">
                    <section className="profile-form-section profile-calendar-toolbar">
                      <div className="profile-calendar-nav">
                        <button type="button" className="profile-calendar-nav-btn" onClick={() => shiftCalendarMonth(-1)}>
                          Mese precedente
                        </button>
                        <strong className="profile-calendar-month-label">{calendarMonthLabel}</strong>
                        <button type="button" className="profile-calendar-nav-btn" onClick={() => shiftCalendarMonth(1)}>
                          Mese successivo
                        </button>
                      </div>
                      <p className="profile-location-text">
                        Attiva i giorni, definisci una o piu fasce orarie e scegli per ogni fascia quali servizi possono essere prenotati.
                      </p>
                    </section>

                    <div className="profile-calendar-layout">
                      {isCalendarEditorOpen ? (
                        <section className="profile-form-section profile-calendar-day-card">
                          <div className="profile-calendar-day-header">
                            <div className="profile-location-copy">
                              <p className="profile-location-kicker">GIORNO SELEZIONATO</p>
                              <h2 className="profile-location-title">{selectedCalendarDate}</h2>
                            </div>
                            <label className="profile-calendar-toggle">
                              <input
                                type="checkbox"
                                checked={calendarDayData.enabled}
                                onChange={(event) => updateCalendarDayField('enabled', event.target.checked)}
                              />
                              <span>Attivo</span>
                            </label>
                          </div>

                          {availableCalendarServices.length === 0 ? (
                            <div className="profile-gallery-empty">
                              Seleziona prima almeno un servizio nella sezione DATI OPERATORE per poter configurare il calendario.
                            </div>
                          ) : isCalendarDayLoading ? (
                            <div className="profile-loading-card">Caricamento giornata in corso...</div>
                          ) : (
                            <>
                              <div className="profile-calendar-actions">
                                <button type="button" className="profile-calendar-action-btn" onClick={addCalendarSlot}>
                                  + Aggiungi fascia
                                </button>
                                {calendarDayData.slots.length > 0 ? (
                                  <>
                                    <button type="button" className="profile-calendar-action-btn" onClick={enableCalendarCopyMode} disabled={isCalendarSaving || isCalendarCopying}>
                                      {isCalendarCopying ? 'Copia...' : 'Avvia copia'}
                                    </button>
                                    <button type="button" className="profile-calendar-action-btn" onClick={exitCalendarEditor}>
                                      Esci
                                    </button>
                                  </>
                                ) : null}
                                <button type="button" className="profile-calendar-action-btn is-primary" onClick={saveCalendarDay} disabled={isCalendarSaving}>
                                  {isCalendarSaving ? 'Salvataggio...' : 'Salva dati'}
                                </button>
                              </div>

                              <div className="profile-calendar-slots">
                                {calendarDayData.slots.length > 0 ? (
                                  calendarDayData.slots.map((slot, slotIndex) => (
                                    <article key={`${slot.id}-${slotIndex}`} className="profile-calendar-slot-card">
                                      <div className="profile-calendar-slot-top">
                                        <div className="profile-calendar-slot-times">
                                          <label className="profile-field">
                                            <span>Inizio</span>
                                            <select
                                              value={slot.startTime}
                                              onChange={(event) => updateCalendarSlot(slotIndex, 'startTime', event.target.value)}
                                            >
                                              {QUARTER_HOUR_OPTIONS.map((timeValue) => (
                                                <option key={`start-${slot.id}-${timeValue}`} value={timeValue}>
                                                  {timeValue}
                                                </option>
                                              ))}
                                            </select>
                                          </label>
                                          <label className="profile-field">
                                            <span>Fine</span>
                                            <select
                                              value={slot.endTime}
                                              onChange={(event) => updateCalendarSlot(slotIndex, 'endTime', event.target.value)}
                                            >
                                              {QUARTER_HOUR_OPTIONS.map((timeValue) => (
                                                <option key={`end-${slot.id}-${timeValue}`} value={timeValue}>
                                                  {timeValue}
                                                </option>
                                              ))}
                                            </select>
                                          </label>
                                        </div>
                                        <div className="profile-calendar-slot-controls">
                                          <label className="profile-calendar-toggle">
                                            <input
                                              type="checkbox"
                                              checked={slot.enabled}
                                              onChange={(event) => updateCalendarSlot(slotIndex, 'enabled', event.target.checked)}
                                            />
                                            <span>Fascia attiva</span>
                                          </label>
                                          <button type="button" className="profile-calendar-remove-btn" onClick={() => removeCalendarSlot(slotIndex)}>
                                            Elimina fascia
                                          </button>
                                        </div>
                                      </div>

                                      <div className="profile-calendar-service-grid">
                                        {availableCalendarServices.map((service) => {
                                          const serviceSelection = slot.services.find((entry) => entry.serviceId === service.id)
                                          const serviceSelected = Boolean(serviceSelection)

                                          return (
                                            <div key={`${slot.id}-${service.id}`} className={`profile-calendar-service-card ${serviceSelected ? 'is-selected' : ''}`}>
                                              <label className="profile-service-head">
                                                <span className="profile-service-checkbox">
                                                  <input
                                                    type="checkbox"
                                                    checked={serviceSelected}
                                                    onChange={() => toggleCalendarSlotService(slotIndex, service.id)}
                                                  />
                                                </span>
                                                <span className="profile-service-copy">
                                                  <strong>{service.name}</strong>
                                                  <small>{service.description}</small>
                                                </span>
                                              </label>
                                              {serviceSelected ? (
                                                <label className="profile-field profile-service-rate">
                                                  <span>Prezzo orario (EUR)</span>
                                                  <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={serviceSelection?.hourlyRate ? String(serviceSelection.hourlyRate) : ''}
                                                    placeholder="Es. 15.50"
                                                    onChange={(event) => updateCalendarSlotServiceRate(slotIndex, service.id, event.target.value)}
                                                  />
                                                </label>
                                              ) : null}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </article>
                                  ))
                                ) : (
                                  <div className="profile-gallery-empty">
                                    Nessuna fascia configurata per questo giorno. Usa il pulsante Aggiungi fascia per iniziare.
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </section>
                      ) : (
                        <section className="profile-form-section profile-calendar-day-card profile-calendar-day-card-closed">
                          <div className="profile-calendar-day-header">
                            <div className="profile-location-copy">
                              <p className="profile-location-kicker">
                                {calendarCopySourceDate ? 'MODALITA COPIA ATTIVA' : 'MODALITA VISUALIZZAZIONE'}
                              </p>
                              <h2 className="profile-location-title">
                                {calendarCopySourceDate
                                  ? `Copia dal giorno ${calendarCopySourceDate}`
                                  : 'Clicca un giorno di calendario per modificare'}
                              </h2>
                            </div>
                            <div className="profile-calendar-actions">
                              {calendarCopySourceDate ? (
                                <button type="button" className="profile-calendar-action-btn" onClick={() => setCalendarCopySourceDate(null)}>
                                  Termina copia
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <p className="profile-location-text">
                            {calendarCopySourceDate
                              ? 'Clicca uno o più giorni del calendario per copiare su ciascuno la configurazione del giorno sorgente.'
                              : 'Seleziona un giorno per aprire il form di editing.'}
                          </p>
                        </section>
                      )}

                      <section className="profile-form-section profile-calendar-month-card">
                        <div className="profile-calendar-weekdays">
                          {CALENDAR_WEEKDAY_LABELS.map((label) => (
                            <span key={label}>{label}</span>
                          ))}
                        </div>
                        <div className="profile-calendar-grid">
                          {calendarGridCells.map((cell, index) => {
                            if (!cell.date || !cell.day) {
                              return <div key={`empty-${index}`} className="profile-calendar-cell is-empty" aria-hidden="true" />
                            }

                            const daySummary = calendarDayMap[cell.date]
                            const isSelected = cell.date === selectedCalendarDate
                            const isToday = cell.date === todayCalendar.isoDate
                            const hasActiveAvailability = (daySummary?.totalMinutes ?? 0) > 0
                            const isConfiguredInactive = hasActiveAvailability && !Boolean(daySummary?.enabled)
                            const durationParts = formatCalendarDurationParts(daySummary?.totalMinutes ?? 0)

                            return (
                              <button
                                key={cell.date}
                                type="button"
                                className={`profile-calendar-cell ${isSelected ? 'is-selected' : ''} ${daySummary?.enabled ? 'is-enabled' : ''} ${hasActiveAvailability ? 'is-occupied' : ''} ${isConfiguredInactive ? 'is-configured-inactive' : ''} ${isToday ? 'is-today' : ''}`}
                                onClick={() => handleCalendarCellClick(cell.date!)}
                              >
                                <strong>{cell.day}</strong>
                                {hasActiveAvailability ? (
                                  <small className="profile-calendar-duration">
                                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                      <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
                                      <path d="M12 7.6v4.8l3.2 1.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <span className="profile-calendar-duration-values">
                                      <span>{durationParts.primary}</span>
                                      <span>{durationParts.secondary}</span>
                                    </span>
                                  </small>
                                ) : (
                                  <small>&nbsp;</small>
                                )}
                              </button>
                            )
                          })}
                        </div>
                        {isCalendarMonthLoading ? <div className="profile-loading-card">Caricamento mese in corso...</div> : null}
                      </section>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </section>
      </section>

      {activeMenu === 'personal' && !isLoading ? (
        <div className="profile-floating-actions">
          <button type="submit" form="profile-personal-form" className="profile-save-button" disabled={isSaving}>
            <span className="profile-save-button-label">Salva dati</span>
            {isSaving ? <span className="profile-save-button-spinner" aria-hidden="true" /> : null}
          </button>
        </div>
      ) : null}

      {activeMenu === 'operator' && !isLoading ? (
        <div className="profile-floating-actions">
          <button type="submit" form="profile-operator-form" className="profile-save-button" disabled={isOperatorSaving}>
            <span className="profile-save-button-label">Salva dati</span>
            {isOperatorSaving ? <span className="profile-save-button-spinner" aria-hidden="true" /> : null}
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
                role="pet_assistant"
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
          role="pet_assistant"
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
