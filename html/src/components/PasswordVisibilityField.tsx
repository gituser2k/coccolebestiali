import { useId, useState } from 'react'

type PasswordVisibilityFieldProps = {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}

export default function PasswordVisibilityField({
  label,
  placeholder,
  value,
  onChange,
}: PasswordVisibilityFieldProps) {
  const [isVisible, setIsVisible] = useState(false)
  const inputId = useId()
  const actionLabel = isVisible ? `Nascondi ${label.toLowerCase()}` : `Mostra ${label.toLowerCase()}`

  return (
    <div className="profile-field profile-password-modal-field">
      <label htmlFor={inputId}>{label}</label>
      <div className="profile-password-input-wrap">
        <input
          id={inputId}
          type={isVisible ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
        />
        <button
          type="button"
          className="profile-password-visibility-toggle"
          aria-label={actionLabel}
          title={actionLabel}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((current) => !current)}
        >
          {isVisible ? (
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.2A10.8 10.8 0 0 1 12 5c5.4 0 8.5 5.3 8.5 5.3a10.8 10.8 0 0 1-2.4 3.1M6.2 6.3a13.8 13.8 0 0 0-2.7 4S6.6 15.7 12 15.7c.8 0 1.6-.1 2.3-.3" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M3.5 12S6.6 6.7 12 6.7 20.5 12 20.5 12 17.4 17.3 12 17.3 3.5 12 3.5 12Z" />
              <circle cx="12" cy="12" r="2.6" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
