import axios from 'axios'
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

  async function loadFromLaravel() {
    setError(null)

    try {
      const response = await axios.get('/api/inertia-demo', {
        headers: {
          'X-Inertia': 'true',
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json',
        },
      })

      const nextProps = response.data?.props as DemoPageProps
      if (nextProps.message) {
        setMessage(nextProps.message)
      } else {
        setError('Messaggio non presente nel payload backend.')
      }
    } catch (error) {
      setError('Errore nel caricamento dal backend.')
    }
  }

  useEffect(() => {
    void loadFromLaravel()
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
