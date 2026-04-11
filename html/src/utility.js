export function sanitizeText(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

export function validateEmail(email) {
  const normalizedEmail = sanitizeText(email)
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

  return emailRegex.test(normalizedEmail)
}

export function areRequiredFieldsFilled(payload) {
  return Boolean(payload.name && payload.email && payload.msg)
}

