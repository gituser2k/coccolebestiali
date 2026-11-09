import '../css/public-footer.css'

export default function PublicFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`public-footer ${className}`.trim()} role="contentinfo" aria-label="Informazioni legali">
      <small>© {new Date().getFullYear()} Coccole Bestiali. Tutti i diritti riservati.</small>
      <a href="https://www.iubenda.com" aria-label="Privacy Policy - iubenda" target="_blank" rel="noreferrer">
        Privacy Policy
      </a>
    </footer>
  )
}
