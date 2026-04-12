import { createInertiaApp } from '@inertiajs/react'
import type { Page } from '@inertiajs/core'
import { createRoot } from 'react-dom/client'
import DemoPage, { type DemoPageProps } from '../pages/DemoPage'
import '../css/index.css'

type DemoInertiaPageProps = DemoPageProps & {
  errors: Record<string, string>
  deferred?: Record<string, string[]>
}

const initialPage: Page<DemoInertiaPageProps> = {
  component: 'DemoPage',
  props: {
    message: 'Caricamento messaggio dal backend...',
    errors: {},
  },
  url: '/demo.html',
  version: '1',
  flash: {},
  rememberedState: {},
}

createInertiaApp({
  page: initialPage,
  resolve: (name) => {
    if (name === 'DemoPage') {
      return DemoPage
    }

    throw new Error(`Componente Inertia non registrato: ${name}`)
  },
  setup({ el, App, props }) {
    createRoot(el).render(<App {...props} />)
  },
})
