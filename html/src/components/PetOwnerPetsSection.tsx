import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import { sanitizeText } from '../utility.js'

type PetOption = {
  id: number
  name: string
}

type PetGalleryItem = {
  id: string
  photo: string
  photoUrl: string
  caption: string
  file: File | null
}

type PetDocumentItem = {
  id: string
  documentType: string
  title: string
  issuedAt: string
  expiresAt: string
  notes: string
  filePath: string
  originalName: string
  mimeType: string
  fileSize: number
  downloadUrl: string
  file: File | null
}

type OwnerPet = {
  id: string
  name: string
  sex: string
  birthDate: string
  microchipCode: string
  generalNotes: string
  petSize: string
  petBreedIds: number[]
  petTypeIds: number[]
  gallery: PetGalleryItem[]
  documents: PetDocumentItem[]
}

type Props = {
  onToast: (message: string, type: 'error' | 'success') => void
}

const PET_SIZE_OPTIONS = [
  { value: 'small', label: 'Taglia piccola (0 - 7 Kg)' },
  { value: 'medium', label: 'Taglia media (7 - 18 Kg)' },
  { value: 'large', label: 'Taglia grande (18 - 45 Kg)' },
  { value: 'max', label: 'Taglia max (oltre 45 Kg)' },
]

const PET_DOCUMENT_TYPE_OPTIONS = [
  { value: 'health_booklet', label: 'Libretto sanitario' },
  { value: 'registry_microchip', label: 'Certificato anagrafe e microchip' },
  { value: 'eu_passport', label: 'Passaporto europeo' },
  { value: 'vaccinations', label: 'Certificato vaccinazioni' },
  { value: 'medical_certificate', label: 'Certificato sanitario / viaggio' },
  { value: 'clinical_reports', label: 'Referti ed esami clinici' },
  { value: 'prescriptions', label: 'Prescrizioni e terapie' },
  { value: 'sterilization', label: 'Certificato sterilizzazione' },
  { value: 'insurance', label: 'Polizza assicurativa' },
  { value: 'adoption_ownership', label: 'Documento adozione / proprietà' },
  { value: 'pedigree', label: 'Pedigree' },
  { value: 'other', label: 'Altro documento' },
]

function createDocument(): PetDocumentItem {
  return {
    id: `new-document-${Date.now()}`,
    documentType: PET_DOCUMENT_TYPE_OPTIONS[0].value,
    title: PET_DOCUMENT_TYPE_OPTIONS[0].label,
    issuedAt: '',
    expiresAt: '',
    notes: '',
    filePath: '',
    originalName: '',
    mimeType: '',
    fileSize: 0,
    downloadUrl: '',
    file: null,
  }
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function createPet(): OwnerPet {
  return {
    id: `new-pet-${Date.now()}`,
    name: '',
    sex: '',
    birthDate: '',
    microchipCode: '',
    generalNotes: '',
    petSize: '',
    petBreedIds: [],
    petTypeIds: [],
    gallery: [],
    documents: [],
  }
}

function normalizePet(item: Record<string, unknown>, index: number): OwnerPet {
  const gallery = Array.isArray(item.gallery) ? item.gallery : []
  const documents = Array.isArray(item.documents) ? item.documents : []

  return {
    id: String(item.id ?? `pet-${index}`),
    name: sanitizeText(item.name ?? ''),
    sex: sanitizeText(item.sex ?? ''),
    birthDate: sanitizeText(item.birthDate ?? ''),
    microchipCode: sanitizeText(item.microchipCode ?? ''),
    generalNotes: sanitizeText(item.generalNotes ?? ''),
    petSize: sanitizeText(item.petSize ?? ''),
    petBreedIds: Array.isArray(item.petBreedIds)
      ? item.petBreedIds.map(Number).filter((id) => id > 0)
      : [],
    petTypeIds: Array.isArray(item.petTypeIds)
      ? item.petTypeIds.map(Number).filter((id) => id > 0)
      : [],
    gallery: gallery.map((galleryItem, galleryIndex) => {
      const normalized = galleryItem as Record<string, unknown>
      return {
        id: String(normalized.id ?? `gallery-${index}-${galleryIndex}`),
        photo: sanitizeText(normalized.photo ?? ''),
        photoUrl: sanitizeText(normalized.photoUrl ?? ''),
        caption: sanitizeText(normalized.caption ?? ''),
        file: null,
      }
    }),
    documents: documents.map((documentItem, documentIndex) => {
      const normalized = documentItem as Record<string, unknown>
      return {
        id: String(normalized.id ?? `document-${index}-${documentIndex}`),
        documentType: sanitizeText(normalized.documentType ?? 'other'),
        title: sanitizeText(normalized.title ?? ''),
        issuedAt: sanitizeText(normalized.issuedAt ?? ''),
        expiresAt: sanitizeText(normalized.expiresAt ?? ''),
        notes: sanitizeText(normalized.notes ?? ''),
        filePath: sanitizeText(normalized.filePath ?? ''),
        originalName: sanitizeText(normalized.originalName ?? ''),
        mimeType: sanitizeText(normalized.mimeType ?? ''),
        fileSize: Number(normalized.fileSize ?? 0),
        downloadUrl: sanitizeText(normalized.downloadUrl ?? ''),
        file: null,
      }
    }),
  }
}

function PetsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="6.4" cy="7" r="2.25" fill="currentColor" />
      <circle cx="11" cy="4.8" r="2.25" fill="currentColor" />
      <circle cx="17.6" cy="7" r="2.25" fill="currentColor" />
      <circle cx="19" cy="12" r="2.1" fill="currentColor" />
      <path d="M12 9.2c-3.65 0-6.5 3.1-6.5 6.15 0 2.2 1.65 3.65 3.65 3.65 1.15 0 1.95-.62 2.85-.62s1.7.62 2.85.62c2 0 3.65-1.45 3.65-3.65 0-3.05-2.85-6.15-6.5-6.15Z" fill="currentColor" />
    </svg>
  )
}

export { PetsIcon }

export default function PetOwnerPetsSection({ onToast }: Props) {
  const [pets, setPets] = useState<OwnerPet[]>([])
  const [petBreeds, setPetBreeds] = useState<PetOption[]>([])
  const [petTypes, setPetTypes] = useState<PetOption[]>([])
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null)
  const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(null)
  const [draggedGalleryId, setDraggedGalleryId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const selectedPetIndex = useMemo(
    () => pets.findIndex((pet) => pet.id === selectedPetId),
    [pets, selectedPetId],
  )
  const selectedPet = selectedPetIndex >= 0 ? pets[selectedPetIndex] : null
  const selectedGalleryItem = selectedPet?.gallery.find((item) => item.id === selectedGalleryId) ?? null

  useEffect(() => {
    let ignore = false

    async function loadPets() {
      setIsLoading(true)
      try {
        const [petsResponse, optionsResponse] = await Promise.all([
          fetch('/api/profile/petowner/pets', { headers: { Accept: 'application/json' } }),
          fetch('/api/profile/petowner/pets/options', { headers: { Accept: 'application/json' } }),
        ])
        const petsPayload = await petsResponse.json().catch(() => ({}))
        const optionsPayload = await optionsResponse.json().catch(() => ({}))

        if (!petsResponse.ok || !petsPayload?.ok) {
          throw new Error(petsPayload?.message || 'Caricamento dei pet non completato.')
        }
        if (!optionsResponse.ok || !optionsPayload?.ok) {
          throw new Error('Caricamento delle caratteristiche non completato.')
        }
        if (ignore) return

        const nextPets = Array.isArray(petsPayload.data)
          ? petsPayload.data.map((item: Record<string, unknown>, index: number) => normalizePet(item, index))
          : []
        const removeAnyOption = (option: PetOption) => option.name.trim().toLowerCase() !== 'qualsiasi'
        setPets(nextPets)
        setPetBreeds((Array.isArray(optionsPayload?.data?.petBreeds) ? optionsPayload.data.petBreeds : []).filter(removeAnyOption))
        setPetTypes((Array.isArray(optionsPayload?.data?.petTypes) ? optionsPayload.data.petTypes : []).filter(removeAnyOption))
        setSelectedPetId(nextPets[0]?.id ?? null)
        setSelectedGalleryId(nextPets[0]?.gallery[0]?.id ?? null)
      } catch (error) {
        if (!ignore) {
          onToast(error instanceof Error ? error.message : 'Caricamento dei pet non completato.', 'error')
        }
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    void loadPets()
    return () => {
      ignore = true
    }
  }, [onToast])

  function updateSelectedPet(updater: (pet: OwnerPet) => OwnerPet) {
    if (selectedPetIndex < 0) return
    setPets((current) => current.map((pet, index) => index === selectedPetIndex ? updater(pet) : pet))
  }

  function addPet() {
    const pet = createPet()
    setPets((current) => [...current, pet])
    setSelectedPetId(pet.id)
    setSelectedGalleryId(null)
  }

  function removePet(petId: string) {
    const petIndex = pets.findIndex((pet) => pet.id === petId)
    const removedPet = pets[petIndex]
    removedPet?.gallery.forEach((item) => {
      if (item.file && item.photoUrl.startsWith('blob:')) URL.revokeObjectURL(item.photoUrl)
    })
    const nextPets = pets.filter((pet) => pet.id !== petId)
    setPets(nextPets)
    if (selectedPetId === petId) {
      const nextPet = nextPets[Math.min(Math.max(petIndex, 0), nextPets.length - 1)] ?? null
      setSelectedPetId(nextPet?.id ?? null)
      setSelectedGalleryId(nextPet?.gallery[0]?.id ?? null)
    }
  }

  function toggleSelection(field: 'petBreedIds' | 'petTypeIds', optionId: number) {
    updateSelectedPet((pet) => ({
      ...pet,
      [field]: pet[field].includes(optionId)
        ? pet[field].filter((id) => id !== optionId)
        : [...pet[field], optionId],
    }))
  }

  function addGalleryItem() {
    if (!selectedPet) return
    const item: PetGalleryItem = {
      id: `new-gallery-${Date.now()}`,
      photo: '',
      photoUrl: '',
      caption: '',
      file: null,
    }
    updateSelectedPet((pet) => ({ ...pet, gallery: [...pet.gallery, item] }))
    setSelectedGalleryId(item.id)
  }

  function updateGalleryFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (!file || !selectedGalleryItem) return
    const previewUrl = URL.createObjectURL(file)
    if (selectedGalleryItem.file && selectedGalleryItem.photoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(selectedGalleryItem.photoUrl)
    }
    updateSelectedPet((pet) => ({
      ...pet,
      gallery: pet.gallery.map((item) => item.id === selectedGalleryItem.id
        ? { ...item, file, photoUrl: previewUrl }
        : item),
    }))
  }

  function removeGalleryItem() {
    if (!selectedGalleryItem || !selectedPet) return
    if (selectedGalleryItem.file && selectedGalleryItem.photoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(selectedGalleryItem.photoUrl)
    }
    const nextGallery = selectedPet.gallery.filter((item) => item.id !== selectedGalleryItem.id)
    updateSelectedPet((pet) => ({ ...pet, gallery: nextGallery }))
    setSelectedGalleryId(nextGallery[0]?.id ?? null)
  }

  function reorderGallery(event: DragEvent<HTMLButtonElement>, targetId: string) {
    event.preventDefault()
    if (!draggedGalleryId || draggedGalleryId === targetId) return
    updateSelectedPet((pet) => {
      const sourceIndex = pet.gallery.findIndex((item) => item.id === draggedGalleryId)
      const targetIndex = pet.gallery.findIndex((item) => item.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return pet
      const gallery = [...pet.gallery]
      const [moved] = gallery.splice(sourceIndex, 1)
      gallery.splice(targetIndex, 0, moved)
      return { ...pet, gallery }
    })
    setDraggedGalleryId(null)
  }

  function addDocument() {
    if (!selectedPet) return
    updateSelectedPet((pet) => ({ ...pet, documents: [...pet.documents, createDocument()] }))
  }

  function updateDocument(documentId: string, changes: Partial<PetDocumentItem>) {
    updateSelectedPet((pet) => ({
      ...pet,
      documents: pet.documents.map((document) => document.id === documentId
        ? { ...document, ...changes }
        : document),
    }))
  }

  function updateDocumentType(document: PetDocumentItem, documentType: string) {
    const previousLabel = PET_DOCUMENT_TYPE_OPTIONS.find((option) => option.value === document.documentType)?.label ?? ''
    const nextLabel = PET_DOCUMENT_TYPE_OPTIONS.find((option) => option.value === documentType)?.label ?? ''
    updateDocument(document.id, {
      documentType,
      title: document.title === '' || document.title === previousLabel ? nextLabel : document.title,
    })
  }

  function updateDocumentFile(documentId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (!file) return
    updateDocument(documentId, {
      file,
      filePath: '',
      originalName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      downloadUrl: '',
    })
    event.target.value = ''
  }

  function removeDocument(documentId: string) {
    updateSelectedPet((pet) => ({
      ...pet,
      documents: pet.documents.filter((document) => document.id !== documentId),
    }))
  }

  async function savePets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pets.some((pet) => sanitizeText(pet.name) === '')) {
      onToast('Indica il nome di ogni pet prima di salvare.', 'error')
      return
    }
    if (pets.some((pet) => pet.documents.some((document) => (
      sanitizeText(document.title) === '' || (!document.file && sanitizeText(document.filePath) === '')
    )))) {
      onToast('Completa titolo e file di ogni documento prima di salvare.', 'error')
      return
    }
    if (pets.some((pet) => pet.documents.some((document) => (
      document.issuedAt !== '' && document.expiresAt !== '' && document.expiresAt < document.issuedAt
    )))) {
      onToast('La scadenza del documento non può precedere la data del documento.', 'error')
      return
    }

    const body = new FormData()
    pets.forEach((pet, petIndex) => {
      body.append(`pets[${petIndex}][name]`, sanitizeText(pet.name))
      body.append(`pets[${petIndex}][sex]`, pet.sex)
      body.append(`pets[${petIndex}][birthDate]`, pet.birthDate)
      body.append(`pets[${petIndex}][microchipCode]`, sanitizeText(pet.microchipCode))
      body.append(`pets[${petIndex}][generalNotes]`, sanitizeText(pet.generalNotes))
      body.append(`pets[${petIndex}][petSize]`, pet.petSize)
      pet.petBreedIds.forEach((id, index) => body.append(`pets[${petIndex}][petBreedIds][${index}]`, String(id)))
      pet.petTypeIds.forEach((id, index) => body.append(`pets[${petIndex}][petTypeIds][${index}]`, String(id)))
      pet.gallery.forEach((item, galleryIndex) => {
        body.append(`pets[${petIndex}][gallery][${galleryIndex}][caption]`, sanitizeText(item.caption))
        if (item.file) {
          body.append(`petGalleryPhotos[${petIndex}][${galleryIndex}]`, item.file)
        } else if (item.photo) {
          body.append(`pets[${petIndex}][gallery][${galleryIndex}][photo]`, item.photo)
        }
      })
      pet.documents.forEach((document, documentIndex) => {
        body.append(`pets[${petIndex}][documents][${documentIndex}][documentType]`, document.documentType)
        body.append(`pets[${petIndex}][documents][${documentIndex}][title]`, sanitizeText(document.title))
        body.append(`pets[${petIndex}][documents][${documentIndex}][issuedAt]`, document.issuedAt)
        body.append(`pets[${petIndex}][documents][${documentIndex}][expiresAt]`, document.expiresAt)
        body.append(`pets[${petIndex}][documents][${documentIndex}][notes]`, sanitizeText(document.notes))
        body.append(`pets[${petIndex}][documents][${documentIndex}][originalName]`, document.originalName)
        body.append(`pets[${petIndex}][documents][${documentIndex}][mimeType]`, document.mimeType)
        body.append(`pets[${petIndex}][documents][${documentIndex}][fileSize]`, String(document.fileSize))
        if (document.file) {
          body.append(`petDocumentFiles[${petIndex}][${documentIndex}]`, document.file)
        } else if (document.filePath) {
          body.append(`pets[${petIndex}][documents][${documentIndex}][filePath]`, document.filePath)
        }
      })
    })

    setIsSaving(true)
    try {
      const response = await fetch('/api/profile/petowner/pets', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Salvataggio dei pet non completato.')
      }
      const nextPets = Array.isArray(payload.data)
        ? payload.data.map((item: Record<string, unknown>, index: number) => normalizePet(item, index))
        : []
      setPets(nextPets)
      setSelectedPetId(nextPets[0]?.id ?? null)
      setSelectedGalleryId(nextPets[0]?.gallery[0]?.id ?? null)
      onToast(payload?.message || 'I tuoi pet sono stati salvati con successo.', 'success')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Salvataggio dei pet non completato.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="profile-loading-card">Caricamento dei tuoi pet in corso...</div>
  }

  return (
    <form id="profile-petowner-pets-form" className="profile-form" onSubmit={savePets}>
      <section className="profile-form-section owner-pets-section">
        <div className="owner-pets-header">
          <div className="profile-location-copy">
            <p className="profile-location-kicker">I TUOI PET</p>
          </div>
          <button type="button" className="profile-gallery-add" onClick={addPet}>+ Aggiungi pet</button>
        </div>

        {pets.length > 0 ? (
          <div className="owner-pets-tabs" role="tablist" aria-label="Seleziona il pet da modificare">
            {pets.map((pet, index) => (
              <button
                key={pet.id}
                type="button"
                role="tab"
                aria-selected={pet.id === selectedPetId}
                className={`owner-pet-tab ${pet.id === selectedPetId ? 'is-active' : ''}`}
                onClick={() => {
                  setSelectedPetId(pet.id)
                  setSelectedGalleryId(pet.gallery[0]?.id ?? null)
                }}
              >
                <span className="owner-pet-tab-number">{index + 1}</span>
                <strong>{sanitizeText(pet.name) || `Pet ${index + 1}`}</strong>
              </button>
            ))}
          </div>
        ) : null}

        {selectedPet ? (
          <div className="owner-pet-editor">
            <div className="owner-pet-editor-head">
              <p className="profile-location-kicker">DATI ANAGRAFICI PET</p>
              <button type="button" className="profile-gallery-remove" onClick={() => removePet(selectedPet.id)}>Elimina pet</button>
            </div>
            <div className="owner-pet-anagraphics-grid">
              <label className="profile-field">
                <span>Nome pet</span>
                <input
                  type="text"
                  value={selectedPet.name}
                  placeholder="Nome del pet"
                  onChange={(event) => updateSelectedPet((pet) => ({ ...pet, name: event.target.value }))}
                />
              </label>
              <label className="profile-field">
                <span>Sesso</span>
                <select
                  value={selectedPet.sex}
                  onChange={(event) => updateSelectedPet((pet) => ({ ...pet, sex: event.target.value }))}
                >
                  <option value="">Non specificato</option>
                  <option value="male">Maschio</option>
                  <option value="female">Femmina</option>
                  <option value="unknown">Non determinato</option>
                </select>
              </label>
              <label className="profile-field">
                <span>Data di nascita</span>
                <input
                  type="date"
                  value={selectedPet.birthDate}
                  onChange={(event) => updateSelectedPet((pet) => ({ ...pet, birthDate: event.target.value }))}
                />
              </label>
              <label className="profile-field">
                <span>Codice microchip</span>
                <input
                  type="text"
                  maxLength={64}
                  value={selectedPet.microchipCode}
                  placeholder="Es. 380260000123456"
                  onChange={(event) => updateSelectedPet((pet) => ({ ...pet, microchipCode: event.target.value }))}
                />
              </label>
              <label className="profile-field owner-pet-general-notes">
                <span>Note generali</span>
                <textarea
                  className="profile-textarea"
                  rows={4}
                  maxLength={4096}
                  value={selectedPet.generalNotes}
                  placeholder="Carattere, abitudini, esigenze e informazioni utili sul pet"
                  onChange={(event) => updateSelectedPet((pet) => ({ ...pet, generalNotes: event.target.value }))}
                />
              </label>
            </div>

            <p className="profile-location-kicker owner-pet-characteristics-title">CARATTERISTICHE PET</p>
            <div className="profile-form-grid profile-form-grid-operator-four owner-pet-fields">
              <label className="profile-field">
                <span>Taglia</span>
                <select
                  value={selectedPet.petSize}
                  onChange={(event) => updateSelectedPet((pet) => ({ ...pet, petSize: event.target.value }))}
                >
                  <option value="">Seleziona</option>
                  {PET_SIZE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <fieldset className="owner-pet-choice-card">
                <legend>Razza pet</legend>
                <div className="owner-pet-choice-list">
                  {petBreeds.map((option) => (
                    <label key={option.id} className="profile-checkbox-option">
                      <input type="checkbox" checked={selectedPet.petBreedIds.includes(option.id)} onChange={() => toggleSelection('petBreedIds', option.id)} />
                      <span>{option.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="owner-pet-choice-card">
                <legend>Tipo di pet</legend>
                <div className="owner-pet-choice-list">
                  {petTypes.map((option) => (
                    <label key={option.id} className="profile-checkbox-option">
                      <input type="checkbox" checked={selectedPet.petTypeIds.includes(option.id)} onChange={() => toggleSelection('petTypeIds', option.id)} />
                      <span>{option.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="profile-gallery-header owner-pet-gallery-header">
              <p className="profile-location-kicker">GALLERY FOTO PET</p>
              <button type="button" className="profile-gallery-add" onClick={addGalleryItem}>+ Aggiungi foto</button>
            </div>
            <div className="profile-gallery-layout owner-pet-gallery-layout">
              <div className="profile-gallery-thumbs">
                {selectedPet.gallery.length > 0 ? selectedPet.gallery.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`profile-gallery-thumb ${item.id === selectedGalleryId ? 'is-active' : ''} ${item.id === draggedGalleryId ? 'is-dragging' : ''}`}
                    onClick={() => setSelectedGalleryId(item.id)}
                    draggable
                    onDragStart={() => setDraggedGalleryId(item.id)}
                    onDragEnd={() => setDraggedGalleryId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => reorderGallery(event, item.id)}
                  >
                    <span className="profile-gallery-thumb-order">{index + 1}</span>
                    <span className="profile-gallery-thumb-frame">
                      {item.photoUrl ? <img src={item.photoUrl} alt={`Foto ${index + 1} di ${selectedPet.name}`} className="profile-gallery-image" /> : <span className="profile-photo-placeholder">Foto pet</span>}
                    </span>
                  </button>
                )) : <div className="profile-gallery-empty">Nessuna foto inserita.</div>}
              </div>
              <div className="profile-gallery-editor">
                {selectedGalleryItem ? (
                  <div className="profile-gallery-card">
                    <div className="profile-gallery-frame">
                      {selectedGalleryItem.photoUrl ? <img src={selectedGalleryItem.photoUrl} alt="Anteprima foto pet" className="profile-gallery-image" /> : <span className="profile-photo-placeholder">Anteprima foto</span>}
                    </div>
                    <label className="profile-upload-button">
                      Carica foto
                      <input type="file" accept="image/*" onChange={updateGalleryFile} />
                    </label>
                    <label className="profile-field">
                      <span>Testo foto</span>
                      <textarea
                        className="profile-textarea"
                        rows={3}
                        value={selectedGalleryItem.caption}
                        onChange={(event) => updateSelectedPet((pet) => ({
                          ...pet,
                          gallery: pet.gallery.map((item) => item.id === selectedGalleryItem.id ? { ...item, caption: event.target.value } : item),
                        }))}
                      />
                    </label>
                    <button type="button" className="profile-gallery-remove" onClick={removeGalleryItem}>Rimuovi foto</button>
                  </div>
                ) : <div className="profile-gallery-empty profile-gallery-empty-editor">Aggiungi o seleziona una foto.</div>}
              </div>
            </div>

            <section className="owner-pet-documents-section" aria-labelledby="owner-pet-documents-title">
              <div className="profile-gallery-header owner-pet-documents-header">
                <div>
                  <p id="owner-pet-documents-title" className="profile-location-kicker">DOCUMENTI DEL PET</p>
                  <p className="owner-pet-documents-intro">
                    Conserva in modo privato documenti sanitari, identificativi, assicurativi e di viaggio.
                  </p>
                </div>
                <button type="button" className="profile-gallery-add" onClick={addDocument}>+ Aggiungi documento</button>
              </div>

              {selectedPet.documents.length > 0 ? (
                <div className="owner-pet-documents-list">
                  {selectedPet.documents.map((document, index) => (
                    <article className="owner-pet-document-card" key={document.id}>
                      <div className="owner-pet-document-card-head">
                        <span className="owner-pet-document-number" aria-hidden="true">{index + 1}</span>
                        <strong>{document.title || `Documento ${index + 1}`}</strong>
                        <button
                          type="button"
                          className="profile-gallery-remove owner-pet-document-remove"
                          onClick={() => removeDocument(document.id)}
                        >
                          Rimuovi
                        </button>
                      </div>

                      <div className="owner-pet-document-fields">
                        <label className="profile-field">
                          <span>Tipologia</span>
                          <select
                            value={document.documentType}
                            onChange={(event) => updateDocumentType(document, event.target.value)}
                          >
                            {PET_DOCUMENT_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="profile-field">
                          <span>Titolo documento</span>
                          <input
                            type="text"
                            value={document.title}
                            maxLength={255}
                            placeholder="Titolo del documento"
                            onChange={(event) => updateDocument(document.id, { title: event.target.value })}
                          />
                        </label>
                        <label className="profile-field">
                          <span>Data documento</span>
                          <input
                            type="date"
                            value={document.issuedAt}
                            onChange={(event) => updateDocument(document.id, { issuedAt: event.target.value })}
                          />
                        </label>
                        <label className="profile-field">
                          <span>Scadenza</span>
                          <input
                            type="date"
                            value={document.expiresAt}
                            onChange={(event) => updateDocument(document.id, { expiresAt: event.target.value })}
                          />
                        </label>
                        <label className="profile-field owner-pet-document-notes">
                          <span>Note</span>
                          <textarea
                            className="profile-textarea"
                            rows={2}
                            maxLength={2048}
                            value={document.notes}
                            placeholder="Informazioni utili, richiami o indicazioni del veterinario"
                            onChange={(event) => updateDocument(document.id, { notes: event.target.value })}
                          />
                        </label>
                      </div>

                      <div className="owner-pet-document-filebar">
                        <div className="owner-pet-document-filecopy">
                          <span className="owner-pet-document-fileicon" aria-hidden="true">DOC</span>
                          <span>
                            <strong>{document.originalName || 'Nessun file selezionato'}</strong>
                            {document.fileSize > 0 ? <small>{formatFileSize(document.fileSize)}</small> : null}
                          </span>
                        </div>
                        <div className="owner-pet-document-actions">
                          {document.downloadUrl ? (
                            <a className="owner-pet-document-download" href={document.downloadUrl}>Scarica</a>
                          ) : null}
                          <label className="profile-upload-button owner-pet-document-upload">
                            {document.filePath || document.file ? 'Sostituisci file' : 'Carica file'}
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                              onChange={(event) => updateDocumentFile(document.id, event)}
                            />
                          </label>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="profile-gallery-empty owner-pet-documents-empty">
                  Nessun documento inserito. Puoi aggiungere, ad esempio, libretto sanitario, microchip o passaporto.
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="owner-pets-empty">
            <PetsIcon />
            <strong>Non hai ancora inserito un pet</strong>
          </div>
        )}
      </section>

      <div className="profile-floating-actions">
        <button type="submit" form="profile-petowner-pets-form" className="profile-save-button" disabled={isSaving}>
          <span className="profile-save-button-label">Salva dati</span>
          {isSaving ? <span className="profile-save-button-spinner" aria-hidden="true" /> : null}
        </button>
      </div>
    </form>
  )
}
