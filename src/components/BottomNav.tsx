export type Tab = 'home' | 'import' | 'settings'

const ITEMS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Inicio' },
  { id: 'import', label: 'Importar' },
  { id: 'settings', label: 'Ajustes' },
]

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="nav" aria-label="Secciones">
      {ITEMS.map((item) => (
        <button key={item.id} type="button" aria-current={tab === item.id ? 'page' : undefined} onClick={() => onChange(item.id)}>
          <NavIcon name={item.id} />
          {item.label}
        </button>
      ))}
    </nav>
  )
}

function NavIcon({ name }: { name: Tab }) {
  if (name === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
      </svg>
    )
  }
  if (name === 'import') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
    </svg>
  )
}
