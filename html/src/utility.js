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

function ensureModalStyles() {
  if (document.getElementById('cb-utility-modal-style')) {
    return
  }

  const style = document.createElement('style')
  style.id = 'cb-utility-modal-style'
  style.textContent = `
    .cb-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 9999;
    }
    .cb-modal {
      width: min(520px, 100%);
      max-height: min(82vh, 680px);
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid #e5e7eb;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .cb-modal-header {
      padding: 14px 16px;
      color: #ffffff;
      font-size: 1.02rem;
      font-weight: 700;
    }
    .cb-modal-body {
      margin: 0;
      padding: 18px 16px 12px;
      color: #333333;
      line-height: 1.45;
      font-size: 0.97rem;
      white-space: pre-wrap;
      overflow: auto;
    }
    .cb-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 12px 16px 16px;
    }
    .cb-modal-btn {
      border: 0;
      border-radius: 8px;
      padding: 10px 16px;
      font-weight: 700;
      cursor: pointer;
      color: #ffffff;
    }
  `

  document.head.appendChild(style)
}

function getModalColor(theme) {
  const normalized = sanitizeText(theme).toLowerCase()

  if (normalized === 'warning') {
    return '#b42318'
  }

  if (normalized === 'alert') {
    return '#a66c00'
  }

  return '#1f5fa7'
}

export function showUtilityModal({
  testo_header = '',
  body = '',
  colorazione = 'notify',
  pulsanti = [],
} = {}) {
  ensureModalStyles()

  const existing = document.getElementById('cb-modal-overlay')
  if (existing) {
    existing.remove()
  }

  const color = getModalColor(colorazione)
  const overlay = document.createElement('div')
  overlay.id = 'cb-modal-overlay'
  overlay.className = 'cb-modal-overlay'

  const close = () => {
    overlay.remove()
  }

  const modal = document.createElement('div')
  modal.className = 'cb-modal'
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.addEventListener('click', (event) => {
    event.stopPropagation()
  })

  const header = document.createElement('div')
  header.className = 'cb-modal-header'
  header.style.background = color
  header.textContent = testo_header

  const bodyNode = document.createElement('p')
  bodyNode.className = 'cb-modal-body'
  bodyNode.innerHTML = String(body ?? '')

  const actions = document.createElement('div')
  actions.className = 'cb-modal-actions'

  const buttons = Array.isArray(pulsanti) ? pulsanti : []
  buttons.forEach((entry) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cb-modal-btn'
    btn.style.background = color
    btn.textContent = entry?.label ? String(entry.label) : 'OK'
    btn.addEventListener('click', async () => {
      if (typeof entry?.callback === 'function') {
        const result = await entry.callback({ close, overlay, modal })
        if (result === false) {
          return
        }
      }

      close()
    })
    actions.appendChild(btn)
  })

  if (actions.children.length === 0) {
    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'cb-modal-btn'
    closeBtn.style.background = color
    closeBtn.textContent = 'Chiudi'
    closeBtn.addEventListener('click', close)
    actions.appendChild(closeBtn)
  }

  modal.append(header, bodyNode, actions)
  overlay.appendChild(modal)
  overlay.addEventListener('click', close)
  document.body.appendChild(overlay)

  return { close, overlay, modal }
}
