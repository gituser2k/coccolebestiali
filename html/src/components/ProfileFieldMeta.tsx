type FieldTone = 'required' | 'private' | 'optional'

type FieldLabelProps = {
  children: string
  tone?: FieldTone
}

const LEGEND_ITEMS = [
  {
    type: 'required',
    label: 'Richiesto',
    description: 'Campo obbligatorio: va compilato per poter salvare correttamente il profilo.',
  },
  {
    type: 'private',
    label: 'Riservato',
    description: 'Informazione visibile solo agli utenti coinvolti in una richiesta di assistenza.',
  },
] as const

export function FieldLabel({ children, tone = 'optional' }: FieldLabelProps) {
  return (
    <span className={`profile-field-label is-${tone}`}>
      <span className="profile-field-label-text">{children}</span>
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
