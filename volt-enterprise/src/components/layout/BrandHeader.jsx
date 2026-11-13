export default function BrandHeader({ title = 'VAULT MOTORS' }) {
  return (
    <div className="brand-header">
      <span className="brand-header__mark" aria-hidden="true">M</span>
      <span className="brand-header__title">{title}</span>
    </div>
  )
}
