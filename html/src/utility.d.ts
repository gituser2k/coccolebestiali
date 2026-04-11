export function sanitizeText(value: unknown): string
export function validateEmail(email: string): boolean
export function areRequiredFieldsFilled(payload: {
  name: string
  email: string
  msg: string
}): boolean

