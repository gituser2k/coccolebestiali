type FieldTone = 'required' | 'private' | 'public' | 'optional'

type FieldLabelProps = {
  children: string
  tone?: FieldTone
  onToneToggle?: () => void
}

const LEGEND_ITEMS = [
  {
    type: 'required',
    label: 'Richiesto',
    description: 'Campo obbligatorio: va compilato per poter salvare correttamente il profilo.',
  },
  {
    type: 'private',
    label: 'Privato',
    description: 'Informazione visibile solo agli utenti coinvolti in una richiesta di assistenza.',
  },
  {
    type: 'public',
    label: 'Pubblico',
    description: 'Informazione visibile pubblicamente nel profilo quando previsto dal portale.',
  },
] as const

export function FieldLabel({ children, tone = 'optional', onToneToggle }: FieldLabelProps) {
  const canToggleTone = Boolean(onToneToggle) && (tone === 'private' || tone === 'public')
  const toggleLabel = tone === 'private' ? 'rendi il campo pubblico' : 'rendi il campo privato'

  return (
    <span className={`profile-field-label is-${tone}`}>
      <span className="profile-field-label-text">{children}</span>
      {canToggleTone ? (
        <button
          type="button"
          className={`profile-field-visibility-toggle is-${tone}`}
          aria-label={toggleLabel}
          title={toggleLabel}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onToneToggle?.()
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M12 5c5 0 8.4 4.3 9.5 6.2a1.6 1.6 0 0 1 0 1.6C20.4 14.7 17 19 12 19s-8.4-4.3-9.5-6.2a1.6 1.6 0 0 1 0-1.6C3.6 9.3 7 5 12 5Zm0 3.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Zm0 2a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z" />
            {tone === 'private' ? (
              <path d="M4.7 3.3 20.7 19.3a1 1 0 0 1-1.4 1.4L3.3 4.7a1 1 0 1 1 1.4-1.4Z" />
            ) : null}
          </svg>
          <span className="profile-field-visibility-tooltip">{toggleLabel}</span>
        </button>
      ) : null}
    </span>
  )
}

export function FieldLegend() {
  return (
    <div className="profile-field-legend" aria-label="Legenda campi profilo">
      {LEGEND_ITEMS.map((item) => (
        <span
          key={item.type}
          className={`profile-field-legend-item is-${item.type}`}
          tabIndex={0}
          aria-label={`${item.label}: ${item.description}`}
        >
          <span className="profile-field-legend-dot" aria-hidden="true" />
          {item.label}
          <span className="profile-field-tooltip" role="tooltip">
            {item.description}
          </span>
        </span>
      ))}
    </div>
  )
}
