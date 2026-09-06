import { Radar } from 'lucide-react'

function formatTimestamp(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short'
    })
  } catch {
    return iso
  }
}

export default function Header({ generatedAt, isDemo }) {
  return (
    <header className="border-b border-graphite-700">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
        <div className="flex items-center gap-3">
          <Radar size={22} strokeWidth={1.75} className="text-signal-amber" />
          <div>
            <h1 className="text-lg font-semibold leading-none text-paper-100">AGI Horizon Tracker</h1>
            <p className="mt-1.5 text-xs text-paper-500">Source-grounded signals across three frontier capability pillars</p>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs text-paper-500">
          {isDemo && (
            <span className="border border-signal-amber/40 px-2 py-1 text-signal-amber">Demo data</span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-blink rounded-full bg-signal-amber" />
            </span>
            Updated {formatTimestamp(generatedAt)}
          </span>
        </div>
      </div>
    </header>
  )
}
