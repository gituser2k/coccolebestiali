import { useEffect, useState } from 'react'

export type DemoPageProps = {
  message?: string
}

export default function DemoPage({ ...initial }: DemoPageProps) {
  const [message, setMessage] = useState<string>(initial.message ?? 'Caricamento...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!error) {
      return
    }

    const timeout = window.setTimeout(() => setError(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [error])

  useEffect(() => {
    let isMounted = true

    async function loadFromLaravel() {
      try {
        const response = await fetch('/api/inertia-demo', {
          headers: {
            'X-Inertia': 'true',
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json',
          },
        })
        if (!response.ok) {
          throw new Error('Richiesta demo non completata.')
        }
        const payload = await response.json()

        if (!isMounted) {
          return
        }

        const nextProps = payload?.props as DemoPageProps
        if (nextProps.message) {
          setMessage(nextProps.message)
        } else {
          setError('Messaggio non presente nel payload backend.')
        }
      } catch {
        if (isMounted) {
          setError('Errore nel caricamento dal backend.')
        }
      }
    }

    void loadFromLaravel()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-6">
      <section className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">{message}</h1>
      </section>
      {error ? (
        <div className="fixed bottom-4 right-4 z-50 max-w-[26rem] rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-xl">
          {error}
        </div>
      ) : null}
    </main>
  )
}
