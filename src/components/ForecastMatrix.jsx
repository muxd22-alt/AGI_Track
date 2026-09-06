const IMPACT_STYLES = {
  Low: 'text-paper-500 border-paper-500/30',
  Medium: 'text-signal-amber border-signal-amber/40',
  High: 'text-signal-rose border-signal-rose/40',
  Critical: 'text-signal-rose border-signal-rose/60 bg-signal-rose/10'
}

const ROWS = [
  { key: '30_days', label: '30 days' },
  { key: '90_days', label: '90 days' },
  { key: '365_days', label: '365 days' }
]

/**
 * Translates the three technical pillars into a plain-language forecast
 * table. These are explicitly framed as projections, not scraped facts.
 */
export default function ForecastMatrix({ forecast }) {
  return (
    <div className="border border-graphite-600 bg-graphite-900/60">
      <header className="border-b border-graphite-700 px-5 py-4">
        <h3 className="text-sm font-medium text-paper-100">Forecast matrix</h3>
        <p className="mt-0.5 text-xs text-paper-500">Projected, not measured — extrapolated from the momentum above.</p>
      </header>
      <div>
        {ROWS.map((row, i) => {
          const entry = forecast?.[row.key]
          if (!entry) return null
          return (
            <div
              key={row.key}
              className={`flex flex-col gap-2 px-5 py-4 sm:grid sm:grid-cols-[72px_1fr_auto] sm:items-center sm:gap-4 ${
                i !== ROWS.length - 1 ? 'border-b border-graphite-700' : ''
              }`}
            >
              <div className="flex items-center justify-between sm:contents">
                <span className="font-mono text-xs text-paper-500">{row.label}</span>
                <span
                  className={`whitespace-nowrap border px-2 py-1 font-mono text-[11px] sm:order-3 ${
                    IMPACT_STYLES[entry.impact_index] ?? IMPACT_STYLES.Medium
                  }`}
                >
                  {entry.impact_index}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-paper-300">{entry.milestone}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
