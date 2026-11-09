export function csrfHeaders(): Record<string, string> {
  const token = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='))?.slice('XSRF-TOKEN='.length)

  return token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {}
}

export function csrfFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = csrfHeaders()['X-XSRF-TOKEN']
    if (token) headers.set('X-XSRF-TOKEN', token)
  }

  return fetch(input, {
    ...init,
    credentials: init.credentials ?? 'same-origin',
    headers,
  })
}
