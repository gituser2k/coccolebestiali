import axios from 'axios'
import { useEffect, useState } from 'react'

export type DemoPageProps = {
  message?: string
}

export default function DemoPage({ ...initial }: DemoPageProps) {
  const [message, setMessage] = useState<string>(initial.message ?? 'Caricamento...')
  const [error, setError] = useState<string | null>(null)

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
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </section>
    </main>
  )
}
