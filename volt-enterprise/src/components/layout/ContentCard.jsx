export default function ContentCard({ title, actions, children, className = '' }) {
  return (
    <section className={`content-card ${className}`.trim()}>
      {(title || actions) && (
        <header className="content-card__header">
          {title && <h2>{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}
