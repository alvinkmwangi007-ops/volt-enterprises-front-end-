import BrandHeader from './BrandHeader'
import { iconForLabel } from './navigation'

/**
 * items: [{ label, path, icon?, badge? }]
 * activePath: path of the selected item
 */
export default function NavigationContainer({ items, activePath, onNavigate }) {
  return (
    <aside className="nav-container">
      <BrandHeader />
      <nav className="nav-container__list" aria-label="Sidebar navigation">
        {items.map(({ label, path, icon, badge }) => {
          const Icon = icon || iconForLabel(label)
          const isActive = activePath === path
          return (
            <button
              key={label}
              type="button"
              className={`nav-link${isActive ? ' nav-link--active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavigate(path)}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
              {badge > 0 && <span className="nav-link__badge" aria-label={`${badge} items`}>{badge}</span>}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
