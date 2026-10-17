import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import logoImage from '../assets/logo.png'
import '../css/profile.css'
import { sanitizeText } from '../utility.js'
import AccountChangeModal, { SocialAccountSwitchActions } from '../components/AccountChangeModal.tsx'
import { FieldLabel, FieldLegend } from '../components/ProfileFieldMeta.tsx'

type MenuKey = 'personal' | 'operator' | 'calendar'

type OperatorTitleOption = {
  id: number
  name: string
}

type PetBreedOption = {
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
  serviceRadiusKm: number
}

type OperatorGalleryItem = {
  id: string
  photo: string
  photoUrl: string
  caption: string
  file: File | null
}

type OperatorType = 'person' | 'association'

type OperatorAssociateItem = {
  id: string
  firstName: string
  lastName: string
  fiscalCode: string
}

type OperatorLinkedAssociation = {
  userId: number
  businessName: string
  vatNumber: string
}

type OperatorProfileData = {
  operatorType: OperatorType
  fiscalCode: string
  businessName: string
  vatNumber: string
  associates: OperatorAssociateItem[]
  linkedAssociations: OperatorLinkedAssociation[]
  bio: string
  experienceYears: number
  titleIds: number[]
  petBreedIds: number[]
  petSize: string
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
  serviceRadiusKm: 5,
}

const DEFAULT_PERSONAL_FIELD_VISIBILITY: PersonalFieldVisibility = {
  name: 'private',
  phone: 'private',
  address: 'private',
  addressnumber: 'private',
}

const EMPTY_OPERATOR_PROFILE: OperatorProfileData = {
  operatorType: 'person',
  fiscalCode: '',
  businessName: '',
  vatNumber: '',
  associates: [],
  linkedAssociations: [],
  bio: '',
  experienceYears: 0,
  titleIds: [],
  petBreedIds: [],
  petSize: '',
  petTypeIds: [],
  houseFeatureIds: [],
  services: [],
  gallery: [],
}

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
const PET_SIZE_OPTIONS = [
  { value: 'small', label: 'Taglia piccola (0 - 7 Kg)' },
  { value: 'medium', label: 'Taglia media (7 - 18 Kg)' },
  { value: 'large', label: 'Taglia grande (18 - 45 kg)' },
  { value: 'max', label: 'Taglia max (oltre 45 Kg)' },
]
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
  const [fieldVisibility, setFieldVisibility] = useState<PersonalFieldVisibility>(DEFAULT_PERSONAL_FIELD_VISIBILITY)
  const [operatorProfile, setOperatorProfile] = useState<OperatorProfileData>(EMPTY_OPERATOR_PROFILE)
  const [operatorTitles, setOperatorTitles] = useState<OperatorTitleOption[]>([])
  const [petBreeds, setPetBreeds] = useState<PetBreedOption[]>([])
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
  const [isPetBreedDropdownOpen, setIsPetBreedDropdownOpen] = useState(false)
  const [isPetTypeDropdownOpen, setIsPetTypeDropdownOpen] = useState(false)
  const [isHouseFeatureDropdownOpen, setIsHouseFeatureDropdownOpen] = useState(false)
  const [isMapLoading, setIsMapLoading] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const leafletMapRef = useRef<L.Map | null>(null)
  const locationMarkerRef = useRef<L.Marker | null>(null)
  const serviceCircleRef = useRef<L.Circle | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'error' | 'success'>('error')
  const [, setAuthProvider] = useState<AuthProvider>('')
  const [isAccountChangeModalOpen, setIsAccountChangeModalOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [credentialEmail, setCredentialEmail] = useState('')
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
  const [selectedCalendarDate, setSelectedCalendarDate] = useState('')
  const [calendarDayData, setCalendarDayData] = useState<CalendarDayData>(createEmptyCalendarDay(todayCalendar.isoDate))
  const [isCalendarEditorOpen, setIsCalendarEditorOpen] = useState(false)
  const [isCalendarMonthLoading, setIsCalendarMonthLoading] = useState(false)
  const [isCalendarDayLoading, setIsCalendarDayLoading] = useState(false)
  const [isCalendarSaving, setIsCalendarSaving] = useState(false)
  const [isCalendarCopying, setIsCalendarCopying] = useState(false)
  const [calendarCopySourceDate, setCalendarCopySourceDate] = useState<string | null>(null)
  const didAttemptInitialGeocodeRef = useRef(false)
  const petBreedDropdownRef = useRef<HTMLDivElement | null>(null)
  const petTypeDropdownRef = useRef<HTMLDivElement | null>(null)
  const houseFeatureDropdownRef = useRef<HTMLDivElement | null>(null)
  const petBreedTriggerRef = useRef<HTMLButtonElement | null>(null)
  const petTypeTriggerRef = useRef<HTMLButtonElement | null>(null)
  const houseFeatureTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [petBreedTriggerWidth, setPetBreedTriggerWidth] = useState(0)
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
      sanitizeText(profile.phone) !== '',
      sanitizeText(profile.address) !== '',
      sanitizeText(profile.addressnumber) !== '',
      sanitizeText(operatorProfile.fiscalCode) !== '' || sanitizeText(operatorProfile.businessName) !== '',
      sanitizeText(operatorProfile.bio) !== '',
      operatorProfile.experienceYears > 0,
      operatorProfile.titleIds.length > 0,
      operatorProfile.petBreedIds.length > 0,
      sanitizeText(operatorProfile.petSize) !== '',
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
    profile.name,
    profile.phone,
    profile.photoUrl,
    operatorProfile.bio,
    operatorProfile.businessName,
    operatorProfile.experienceYears,
    operatorProfile.fiscalCode,
    operatorProfile.petBreedIds.length,
    operatorProfile.petSize,
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
  const accountProviderLabel = 'Cambio Credenziali'
  const accountActionLabel = 'Gestisci Credenziali'

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

    const anyOption = options.find((option) => isAnyMultiselectOption(option))
    if (anyOption && selectedIds.includes(anyOption.id)) {
      return anyOption.name
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
    // Helper depends only on the provided values and DOM trigger width.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorProfile.petTypeIds, petTypes, petTypeTriggerWidth])

  const petBreedSummary = useMemo(() => {
    return buildMultiSelectSummary(operatorProfile.petBreedIds, petBreeds, petBreedTriggerRef.current, petBreedTriggerWidth)
    // Helper depends only on the provided values and DOM trigger width.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorProfile.petBreedIds, petBreeds, petBreedTriggerWidth])

  const houseFeatureSummary = useMemo(() => {
    return buildMultiSelectSummary(operatorProfile.houseFeatureIds, houseFeatures, houseFeatureTriggerRef.current, houseFeatureTriggerWidth)
    // Helper depends only on the provided values and DOM trigger width.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorProfile.houseFeatureIds, houseFeatures, houseFeatureTriggerWidth])

  useEffect(() => {
    if (activeMenu !== 'operator' || isLoading || !petBreedTriggerRef.current) {
      return
    }

    const syncWidth = () => {
      if (petBreedTriggerRef.current) {
        setPetBreedTriggerWidth(Math.round(petBreedTriggerRef.current.getBoundingClientRect().width))
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
        setPetBreedTriggerWidth(Math.round(entry.contentRect.width))
      }
    })

    observer.observe(petBreedTriggerRef.current)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncWidth)
    }
  }, [activeMenu, isLoading, petBreeds.length])

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

  function setManualMapPosition(lat: number, lng: number) {
    const nextLat = Number(lat.toFixed(7))
    const nextLng = Number(lng.toFixed(7))

    setProfile((current) => ({
      ...current,
      locationLat: nextLat,
      locationLng: nextLng,
    }))
  }

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

    const circle = L.circle(initialPosition, {
      radius: Math.max(profile.serviceRadiusKm, 1) * 1000,
      color: '#1f5fa7',
      weight: 2,
      fillColor: '#2f7a4a',
      fillOpacity: 0.13,
    }).addTo(map)

    marker.on('dragend', () => {
      const nextPosition = marker.getLatLng()
      setManualMapPosition(nextPosition.lat, nextPosition.lng)
    })

    leafletMapRef.current = map
    locationMarkerRef.current = marker
    serviceCircleRef.current = circle

    window.setTimeout(() => map.invalidateSize(), 100)

    return () => {
      map.remove()
      leafletMapRef.current = null
      locationMarkerRef.current = null
      serviceCircleRef.current = null
    }
    // Leaflet must be mounted only when the personal tab becomes visible; marker and circle updates are handled by the dedicated effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu, isLoading])

  useEffect(() => {
    const map = leafletMapRef.current
    const marker = locationMarkerRef.current
    const circle = serviceCircleRef.current

    if (!map || !marker || !circle || profile.locationLat === 0 || profile.locationLng === 0) {
      return
    }

    const position = L.latLng(profile.locationLat, profile.locationLng)
    marker.setLatLng(position)
    circle.setLatLng(position)
    circle.setRadius(Math.max(profile.serviceRadiusKm, 1) * 1000)

    if (!map.getBounds().contains(position)) {
      map.setView(position, Math.max(map.getZoom(), 14))
    }
  }, [profile.locationLat, profile.locationLng, profile.serviceRadiusKm])

  useEffect(() => {
    async function loadProfileData() {
      setIsLoading(true)

      try {
        const [userResponse, profileResponse, operatorProfileResponse, operatorOptionsResponse] = await Promise.all([
          fetch('/api/auth/me', { headers: { Accept: 'application/json' } }),
          fetch('/api/profile/petassistant/personal', { headers: { Accept: 'application/json' } }),
          fetch('/api/profile/petassistant/operator', { headers: { Accept: 'application/json' } }),
          fetch('/api/profile/operator/options', { headers: { Accept: 'application/json' } }),
        ])

        const userPayload = await userResponse.json().catch(() => ({}))
        const profilePayload = await profileResponse.json().catch(() => ({}))
        const operatorProfilePayload = await operatorProfileResponse.json().catch(() => ({}))
        const operatorOptionsPayload = await operatorOptionsResponse.json().catch(() => ({}))

        if (!userResponse.ok || !userPayload?.ok) {
          throw new Error('Sessione utente non disponibile. Effettua una nuova registrazione o autenticazione.')
        }

        if (!profileResponse.ok || !profilePayload?.ok) {
          throw new Error(profilePayload?.message || 'Profilo non disponibile.')
        }

        if (operatorOptionsResponse.ok && operatorOptionsPayload?.ok) {
          setOperatorTitles(Array.isArray(operatorOptionsPayload?.data?.titles) ? operatorOptionsPayload.data.titles : [])
          setPetBreeds(Array.isArray(operatorOptionsPayload?.data?.petBreeds) ? operatorOptionsPayload.data.petBreeds : [])
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
          locationLat: Number(profilePayload?.data?.locationLat ?? 0),
          locationLng: Number(profilePayload?.data?.locationLng ?? 0),
          serviceRadiusKm: Math.max(Number(profilePayload?.data?.serviceRadiusKm ?? 5), 1),
        })

        setOperatorProfile({
          ...EMPTY_OPERATOR_PROFILE,
          ...operatorProfilePayload?.data,
          operatorType: operatorProfilePayload?.data?.operatorType === 'association' ? 'association' : 'person',
          fiscalCode: sanitizeText(operatorProfilePayload?.data?.fiscalCode ?? ''),
          businessName: sanitizeText(operatorProfilePayload?.data?.businessName ?? ''),
          vatNumber: sanitizeText(operatorProfilePayload?.data?.vatNumber ?? ''),
          associates: Array.isArray(operatorProfilePayload?.data?.associates)
            ? operatorProfilePayload.data.associates.map((item: Record<string, unknown>, index: number) => ({
                id: String(item.id ?? `associate-${index}`),
                firstName: sanitizeText(item.firstName ?? ''),
                lastName: sanitizeText(item.lastName ?? ''),
                fiscalCode: sanitizeText(item.fiscalCode ?? ''),
              }))
            : [],
          linkedAssociations: Array.isArray(operatorProfilePayload?.data?.linkedAssociations)
            ? operatorProfilePayload.data.linkedAssociations.map((item: Record<string, unknown>) => ({
                userId: Number(item.userId ?? 0),
                businessName: sanitizeText(item.businessName ?? ''),
                vatNumber: sanitizeText(item.vatNumber ?? ''),
              })).filter((item: OperatorLinkedAssociation) => item.userId > 0)
            : [],
          titleIds: Array.isArray(operatorProfilePayload?.data?.titleIds)
            ? operatorProfilePayload.data.titleIds.map((value: number | string) => Number(value)).filter((value: number) => value > 0)
            : [],
          petBreedIds: Array.isArray(operatorProfilePayload?.data?.petBreedIds)
            ? operatorProfilePayload.data.petBreedIds.map((value: number | string) => Number(value)).filter((value: number) => value > 0)
            : [],
          petSize: sanitizeText(operatorProfilePayload?.data?.petSize ?? ''),
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
    // Calendar month loading is intentionally driven by the selected tab/year/month.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    }

    setProfile((current) => ({
      ...current,
      [field]: value,
    }))
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

  function updateOperatorType(operatorType: OperatorType) {
    setOperatorProfile((current) => ({
      ...current,
      operatorType,
      businessName: operatorType === 'association' ? current.businessName : '',
      vatNumber: operatorType === 'association' ? current.vatNumber : '',
      associates: operatorType === 'association' ? current.associates : [],
    }))
  }

  function addOperatorAssociate() {
    setOperatorProfile((current) => ({
      ...current,
      associates: [
        ...current.associates,
        {
          id: `new-associate-${Date.now()}`,
          firstName: '',
          lastName: '',
          fiscalCode: '',
        },
      ],
    }))
  }

  function updateOperatorAssociate(index: number, field: keyof Omit<OperatorAssociateItem, 'id'>, value: string) {
    setOperatorProfile((current) => ({
      ...current,
      associates: current.associates.map((associate, associateIndex) =>
        associateIndex === index
          ? {
              ...associate,
              [field]: value,
            }
          : associate
      ),
    }))
  }

  function removeOperatorAssociate(index: number) {
    setOperatorProfile((current) => ({
      ...current,
      associates: current.associates.filter((_, associateIndex) => associateIndex !== index),
    }))
  }

  function isAnyMultiselectOption(option: { name: string }) {
    return sanitizeText(option.name).toLowerCase() === 'qualsiasi'
  }

  function toggleOperatorSelection(
    field: 'titleIds' | 'petBreedIds' | 'petTypeIds' | 'houseFeatureIds',
    id: number,
    options: Array<{ id: number; name: string }> = []
  ) {
    setOperatorProfile((current) => {
      const values = current[field]
      const anyOption = options.find((option) => isAnyMultiselectOption(option))
      const anyId = anyOption?.id ?? 0

      if (anyId > 0 && id === anyId) {
        return {
          ...current,
          [field]: values.includes(anyId) ? [] : options.map((option) => option.id),
        }
      }

      if (anyId > 0) {
        const valuesWithoutAny = values.filter((value) => value !== anyId)
        const alreadySelected = valuesWithoutAny.includes(id)
        const nextValues = alreadySelected
          ? valuesWithoutAny.filter((value) => value !== id)
          : [...valuesWithoutAny, id]
        const regularOptionIds = options.filter((option) => option.id !== anyId).map((option) => option.id)
        const allRegularOptionsSelected = regularOptionIds.length > 0
          && regularOptionIds.every((optionId) => nextValues.includes(optionId))

        return {
          ...current,
          [field]: allRegularOptionsSelected ? options.map((option) => option.id) : nextValues,
        }
      }

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
    setCalendarYear(nextYear)
    setCalendarMonth(nextMonth)
    setSelectedCalendarDate('')
    setIsCalendarEditorOpen(false)
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
    setIsCalendarDayLoading(true)
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

      setProfile((current) => ({
        ...current,
        locationLat: Number(payload.data.lat),
        locationLng: Number(payload.data.lng),
      }))

      const map = leafletMapRef.current
      const marker = locationMarkerRef.current
      const circle = serviceCircleRef.current
      if (map) {
        const position = L.latLng(Number(payload.data.lat), Number(payload.data.lng))
        const radius = Math.max(profile.serviceRadiusKm, 1) * 1000
        marker?.setLatLng(position)
        circle?.setLatLng(position)
        circle?.setRadius(radius)
        const bounds = L.circle(position, { radius }).getBounds()
        map.fitBounds(bounds.pad(0.2), {
          animate: true,
          maxZoom: payload?.data?.precision === 'civico' ? 16 : 15,
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
    body.append('serviceRadiusKm', String(Math.max(profile.serviceRadiusKm, 1)))
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
      const response = await fetch('/api/profile/petassistant/password', {
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

  async function handleSaveOperatorData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const body = new FormData()
    body.append('operatorType', operatorProfile.operatorType)
    if (sanitizeText(operatorProfile.fiscalCode) !== '') {
      body.append('fiscalCode', sanitizeText(operatorProfile.fiscalCode).toUpperCase())
    }
    if (operatorProfile.operatorType === 'association') {
      if (sanitizeText(operatorProfile.businessName) !== '') {
        body.append('businessName', sanitizeText(operatorProfile.businessName))
      }
      if (sanitizeText(operatorProfile.vatNumber) !== '') {
        body.append('vatNumber', sanitizeText(operatorProfile.vatNumber).toUpperCase())
      }
      operatorProfile.associates.forEach((associate, index) => {
        body.append(`associates[${index}][firstName]`, sanitizeText(associate.firstName))
        body.append(`associates[${index}][lastName]`, sanitizeText(associate.lastName))
        body.append(`associates[${index}][fiscalCode]`, sanitizeText(associate.fiscalCode).toUpperCase())
      })
    }

    if (sanitizeText(operatorProfile.bio) !== '') {
      body.append('bio', sanitizeText(operatorProfile.bio))
    }
    if (operatorProfile.experienceYears > 0) {
      body.append('experienceYears', String(operatorProfile.experienceYears))
    }
    if (sanitizeText(operatorProfile.petSize) !== '') {
      body.append('petSize', sanitizeText(operatorProfile.petSize))
    }

    operatorProfile.titleIds.forEach((titleId) => {
      body.append('titleIds[]', String(titleId))
    })
    operatorProfile.petBreedIds.forEach((petBreedId) => {
      body.append('petBreedIds[]', String(petBreedId))
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
        operatorType: payload?.data?.operatorType === 'association' ? 'association' : 'person',
        fiscalCode: sanitizeText(payload?.data?.fiscalCode ?? ''),
        businessName: sanitizeText(payload?.data?.businessName ?? ''),
        vatNumber: sanitizeText(payload?.data?.vatNumber ?? ''),
        associates: Array.isArray(payload?.data?.associates)
          ? payload.data.associates.map((item: Record<string, unknown>, index: number) => ({
              id: String(item.id ?? `associate-${index}`),
              firstName: sanitizeText(item.firstName ?? ''),
              lastName: sanitizeText(item.lastName ?? ''),
              fiscalCode: sanitizeText(item.fiscalCode ?? ''),
            }))
          : [],
        linkedAssociations: Array.isArray(payload?.data?.linkedAssociations)
          ? payload.data.linkedAssociations.map((item: Record<string, unknown>) => ({
              userId: Number(item.userId ?? 0),
              businessName: sanitizeText(item.businessName ?? ''),
              vatNumber: sanitizeText(item.vatNumber ?? ''),
            })).filter((item: OperatorLinkedAssociation) => item.userId > 0)
          : [],
        titleIds: Array.isArray(payload?.data?.titleIds) ? payload.data.titleIds.map((value: number | string) => Number(value)).filter((value: number) => value > 0) : [],
        petBreedIds: Array.isArray(payload?.data?.petBreedIds) ? payload.data.petBreedIds.map((value: number | string) => Number(value)).filter((value: number) => value > 0) : [],
        petSize: sanitizeText(payload?.data?.petSize ?? ''),
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
                            <label className="profile-field profile-radius-field">
                              <span>Raggio operativo</span>
                              <select
                                value={profile.serviceRadiusKm}
                                onChange={(event) => updateProfileField('serviceRadiusKm', Number(event.target.value))}
                              >
                                {[1, 2, 3, 5, 10, 15, 20, 30, 50].map((radius) => (
                                  <option key={radius} value={radius}>
                                    {radius} km
                                  </option>
                                ))}
                              </select>
                            </label>
                            <p className="profile-map-help">
                              Se l&apos;indirizzo non viene trovato con precisione, trascina il puntino GPS sul punto corretto. Ai pet owner potra essere mostrata l&apos;area di copertura invece dell&apos;indirizzo puntuale.
                            </p>
                          </div>
                          <div className="profile-map-card">
                            <div
                              ref={mapContainerRef}
                              className="profile-map-frame"
                              aria-label="Mappa interattiva posizione operatore"
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
              ) : activeMenu === 'operator' ? (
                <>
                  <p className="profile-stage-kicker">PROFILO PET ASSISTANT</p>
                  <h1 className="profile-stage-title">Dati operatore</h1>

                  {isLoading ? (
                    <div className="profile-loading-card">Caricamento dati operatore in corso...</div>
                  ) : (
                    <form id="profile-operator-form" className="profile-form" onSubmit={handleSaveOperatorData}>
                      <section className="profile-form-section profile-operator-identity-section">
                        <div className="profile-location-copy">
                          <p className="profile-location-kicker">TIPO OPERATORE</p>
                        </div>
                        <div className="profile-operator-type-choice" role="radiogroup" aria-label="Tipo operatore">
                          <label className={`profile-radio-card ${operatorProfile.operatorType === 'person' ? 'is-selected' : ''}`}>
                            <input
                              type="radio"
                              name="operatorType"
                              value="person"
                              checked={operatorProfile.operatorType === 'person'}
                              onChange={() => updateOperatorType('person')}
                            />
                            <span>
                              <strong>Persona fisica</strong>
                            </span>
                          </label>
                          <label className={`profile-radio-card ${operatorProfile.operatorType === 'association' ? 'is-selected' : ''}`}>
                            <input
                              type="radio"
                              name="operatorType"
                              value="association"
                              checked={operatorProfile.operatorType === 'association'}
                              onChange={() => updateOperatorType('association')}
                            />
                            <span>
                              <strong>Associazione</strong>
                            </span>
                          </label>
                        </div>

                        {operatorProfile.operatorType === 'association' ? (
                          <>
                            <div className="profile-form-grid profile-form-section-compact">
                              <label className="profile-field">
                                <span>Ragione sociale</span>
                                <input
                                  type="text"
                                  value={operatorProfile.businessName}
                                  placeholder="Nome associazione"
                                  onChange={(event) => updateOperatorField('businessName', event.target.value)}
                                />
                              </label>
                              <label className="profile-field">
                                <span>P.IVA</span>
                                <input
                                  type="text"
                                  value={operatorProfile.vatNumber}
                                  placeholder="Partita IVA"
                                  onChange={(event) => updateOperatorField('vatNumber', event.target.value)}
                                />
                              </label>
                            </div>
                            <div className="profile-associates-panel">
                              <div className="profile-associates-head">
                                <div>
                                  <p className="profile-location-kicker">ASSOCIATI</p>
                                </div>
                                <button className="profile-inline-action" type="button" onClick={addOperatorAssociate}>
                                  Aggiungi associato
                                </button>
                              </div>
                              {operatorProfile.associates.length > 0 ? (
                                <div className="profile-associates-list">
                                  {operatorProfile.associates.map((associate, index) => (
                                    <div className="profile-associate-row" key={associate.id}>
                                      <label className="profile-field">
                                        <span>Nome</span>
                                        <input
                                          type="text"
                                          value={associate.firstName}
                                          onChange={(event) => updateOperatorAssociate(index, 'firstName', event.target.value)}
                                        />
                                      </label>
                                      <label className="profile-field">
                                        <span>Cognome</span>
                                        <input
                                          type="text"
                                          value={associate.lastName}
                                          onChange={(event) => updateOperatorAssociate(index, 'lastName', event.target.value)}
                                        />
                                      </label>
                                      <label className="profile-field">
                                        <span>Codice fiscale</span>
                                        <input
                                          type="text"
                                          value={associate.fiscalCode}
                                          onChange={(event) => updateOperatorAssociate(index, 'fiscalCode', event.target.value.toUpperCase())}
                                        />
                                      </label>
                                      <button className="profile-inline-action is-danger" type="button" onClick={() => removeOperatorAssociate(index)}>
                                        Rimuovi
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="profile-empty-note">Nessun associato inserito.</p>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <label className="profile-field profile-fiscal-code-field">
                              <span>Codice fiscale</span>
                              <input
                                type="text"
                                value={operatorProfile.fiscalCode}
                                placeholder="Codice fiscale"
                                onChange={(event) => updateOperatorField('fiscalCode', event.target.value.toUpperCase())}
                              />
                            </label>
                            <div className="profile-linked-associations">
                              <p className="profile-location-kicker">ASSOCIAZIONI COLLEGATE</p>
                              {operatorProfile.linkedAssociations.length > 0 ? (
                                <div className="profile-linked-associations-list">
                                  {operatorProfile.linkedAssociations.map((association) => (
                                    <span key={association.userId} className="profile-linked-association-pill">
                                      {association.businessName || 'Associazione'}{association.vatNumber ? ` · P.IVA ${association.vatNumber}` : ''}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="profile-empty-note">Nessuna associazione collegata al codice fiscale indicato.</p>
                              )}
                            </div>
                          </>
                        )}
                      </section>

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

                      <section className="profile-form-section profile-pet-scope-section">
                        <div className="profile-location-copy">
                          <p className="profile-location-kicker">CARATTERISTICHE PET</p>
                        </div>
                        <div className="profile-form-grid profile-pet-characteristics-grid">
                          <div className="profile-field profile-multiselect-field" ref={petBreedDropdownRef}>
                            <span>Razza pet</span>
                            <button
                              type="button"
                              className={`profile-multiselect-trigger ${isPetBreedDropdownOpen ? 'is-open' : ''}`}
                              ref={petBreedTriggerRef}
                              onClick={() => setIsPetBreedDropdownOpen((current) => !current)}
                              aria-haspopup="listbox"
                              aria-expanded={isPetBreedDropdownOpen}
                            >
                              <span className={`profile-multiselect-value ${operatorProfile.petBreedIds.length > 0 ? 'is-selected' : ''}`}>
                                {petBreedSummary}
                              </span>
                            </button>
                            {isPetBreedDropdownOpen ? (
                              <div className="profile-city-dropdown profile-multiselect-dropdown" role="listbox" aria-multiselectable="true">
                                {petBreeds.length > 0 ? (
                                  petBreeds.map((petBreed) => (
                                    <label
                                      key={petBreed.id}
                                      className={`profile-multiselect-option ${isAnyMultiselectOption(petBreed) ? 'is-any-option' : ''}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={operatorProfile.petBreedIds.includes(petBreed.id)}
                                        onChange={() => toggleOperatorSelection('petBreedIds', petBreed.id, petBreeds)}
                                      />
                                      <span>{petBreed.name}</span>
                                    </label>
                                  ))
                                ) : (
                                  <div className="profile-city-state">Nessuna razza disponibile.</div>
                                )}
                              </div>
                            ) : null}
                          </div>
                          <label className="profile-field">
                            <span>Taglia</span>
                            <select
                              value={operatorProfile.petSize}
                              onChange={(event) => updateOperatorField('petSize', event.target.value)}
                            >
                              <option value="">Seleziona</option>
                              {PET_SIZE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
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
                                    <label
                                      key={petType.id}
                                      className={`profile-multiselect-option ${isAnyMultiselectOption(petType) ? 'is-any-option' : ''}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={operatorProfile.petTypeIds.includes(petType.id)}
                                        onChange={() => toggleOperatorSelection('petTypeIds', petType.id, petTypes)}
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
                        </div>
                      </section>

                      <section className="profile-form-section">
                        <div className="profile-location-copy">
                          <p className="profile-location-kicker">QUALIFICA</p>
                        </div>
                        <div className="profile-field">
                          <div className="profile-checkbox-grid">
                            {operatorTitles.map((title) => (
                              <label key={title.id} className="profile-checkbox-option">
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
                          <p className="profile-location-kicker">SERVIZI</p>
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
                  <p className="profile-stage-kicker">IMPOSTA LA DISPONIBILITA DEI GIORNI PRENOTABILI</p>
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
                        Clicca sul giorno da impostare, definisci una o piu fasce orarie e scegli per ogni fascia quali servizi possono essere prenotati.
                      </p>
                    </section>

                    <div className="profile-calendar-layout">
                      {isCalendarEditorOpen ? (
                        <section className="profile-form-section profile-calendar-day-card">
                          <div className="profile-calendar-day-header">
                            <div className="profile-calendar-selected-heading">
                              <p className="profile-location-kicker">GIORNO SELEZIONATO</p>
                              <time className="profile-calendar-selected-date" dateTime={selectedCalendarDate}>
                                {selectedCalendarDate}
                              </time>
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
                          {isCalendarDayLoading ? (
                            <div className="profile-loading-card">Caricamento giornata in corso...</div>
                          ) : (
                            <>
                              <div className="profile-calendar-actions">
                                <div className="profile-calendar-actions-left">
                                  <div className="profile-calendar-actions-group">
                                    <button type="button" className="profile-calendar-action-btn" onClick={addCalendarSlot}>
                                      <svg className="profile-calendar-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                        <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
                                        <path d="M12 7.6v4.9l3.25 1.95" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                      <span>Aggiungi Fascia</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="profile-calendar-action-btn"
                                      onClick={enableCalendarCopyMode}
                                      disabled={calendarDayData.slots.length === 0 || isCalendarSaving || isCalendarCopying}
                                    >
                                      <svg className="profile-calendar-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                        <rect x="8" y="8" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                                        <path d="M6 15.5H5.8A2.8 2.8 0 0 1 3 12.7V5.8A2.8 2.8 0 0 1 5.8 3h6.9A2.8 2.8 0 0 1 15.5 5.8V6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                      </svg>
                                      <span>{isCalendarCopying ? 'Copia...' : 'Avvia Copia'}</span>
                                    </button>
                                  </div>
                                  <div className="profile-calendar-copy-hint">
                                    <strong>Avvia Copia</strong>
                                    <span>Attiva la Copia del GIORNO SELEZIONATO come modello e poi clicca uno o piu giorni del calendario per replicarlo. Successivamente clicca su Termina Copia per uscire dalla modalit&agrave; di copia.</span>
                                  </div>
                                </div>
                                <div className="profile-calendar-actions-group profile-calendar-actions-right">
                                  <button type="button" className="profile-calendar-action-btn is-close" onClick={exitCalendarEditor}>
                                    Chiudi
                                  </button>
                                  <button type="button" className="profile-calendar-action-btn is-primary" onClick={saveCalendarDay} disabled={calendarDayData.slots.length === 0 || isCalendarSaving}>
                                    {isCalendarSaving ? 'Salvataggio...' : 'Salva dati'}
                                  </button>
                                </div>
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
                                        {availableCalendarServices.length === 0 ? (
                                          <div className="profile-gallery-empty">
                                            Nessun servizio disponibile: seleziona almeno un servizio nella sezione DATI OPERATORE prima di salvare la fascia.
                                          </div>
                                        ) : availableCalendarServices.map((service) => {
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
                                    Nessuna fascia configurata per questo giorno. Usa il pulsante Aggiungi Fascia per iniziare.
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </section>
                      ) : (
                        <section className="profile-form-section profile-calendar-day-card profile-calendar-day-card-closed">
                          <div className="profile-calendar-day-header">
                            <div className="profile-location-copy profile-calendar-copy-heading">
                              <div>
                                <p className="profile-location-kicker">
                                  {calendarCopySourceDate ? 'MODALITA COPIA ATTIVA' : 'MODALITA VISUALIZZAZIONE'}
                                </p>
                                <h2 className="profile-location-title">
                                  {calendarCopySourceDate
                                    ? `Giorno Sorgente: ${calendarCopySourceDate}`
                                    : 'Clicca su un giorno di calendario per programmare la giornata'}
                                </h2>
                              </div>
                              {calendarCopySourceDate ? (
                                <button type="button" className="profile-calendar-action-btn" onClick={() => setCalendarCopySourceDate(null)}>
                                  Termina Copia
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <p className="profile-location-text">
                            {calendarCopySourceDate
                              ? 'Clicca uno o più giorni del calendario per copiare su ciascuno la configurazione del giorno sorgente.'
                              : 'Apri un giorno, aggiungi le fasce orarie e salva la disponibilita. Usa Avvia Copia quando vuoi replicare una giornata gia impostata su altri giorni.'}
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
                            const isSelected = isCalendarEditorOpen && cell.date === selectedCalendarDate
                            const isToday = cell.date === todayCalendar.isoDate
                            const isCopySource = cell.date === calendarCopySourceDate
                            const hasActiveAvailability = (daySummary?.totalMinutes ?? 0) > 0
                            const isConfiguredInactive = hasActiveAvailability && !daySummary?.enabled
                            const durationParts = formatCalendarDurationParts(daySummary?.totalMinutes ?? 0)

                            return (
                              <button
                                key={cell.date}
                                type="button"
                                className={`profile-calendar-cell ${isSelected ? 'is-selected' : ''} ${daySummary?.enabled ? 'is-enabled' : ''} ${hasActiveAvailability ? 'is-occupied' : ''} ${isConfiguredInactive ? 'is-configured-inactive' : ''} ${isToday ? 'is-today' : ''} ${isCopySource ? 'is-copy-source' : ''} ${calendarCopySourceDate && !isCopySource ? 'is-copy-target' : ''}`}
                                onClick={() => handleCalendarCellClick(cell.date!)}
                                title={isCopySource ? 'Giorno sorgente della copia' : undefined}
                                aria-pressed={isSelected}
                              >
                                <strong>{cell.day}</strong>
                                {isSelected && !isCopySource ? (
                                  <span className="profile-calendar-selected-marker" aria-hidden="true">✓</span>
                                ) : null}
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
                role="pet_assistant"
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
