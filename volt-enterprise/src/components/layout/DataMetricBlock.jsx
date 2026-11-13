export default function DataMetricBlock({ label, value }) {
  return (
    <div className="data-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
