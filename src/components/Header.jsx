import { Radar, Languages } from 'lucide-react'
import { useState, useEffect } from 'react'

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
  const [isArabic, setIsArabic] = useState(false);

  useEffect(() => {
    if (document.cookie.includes('googtrans=/en/ar') || document.cookie.includes('googtrans=%2Fen%2Far')) {
      setIsArabic(true);
    }
  }, []);

  const toggleTranslation = () => {
    if (isArabic) {
      document.cookie = `googtrans=/en/en; path=/;`;
      if (window.location.hostname !== 'localhost') {
        document.cookie = `googtrans=/en/en; domain=${window.location.hostname}; path=/;`;
      }
      window.location.reload();
    } else {
      document.cookie = `googtrans=/en/ar; path=/;`;
      if (window.location.hostname !== 'localhost') {
        document.cookie = `googtrans=/en/ar; domain=${window.location.hostname}; path=/;`;
      }
      window.location.reload();
    }
  };

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

        <div className="flex flex-wrap items-center gap-4 font-mono text-xs text-paper-500">
          {isDemo && (
            <span className="border border-signal-amber/40 px-2 py-1 text-signal-amber">Demo data</span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-blink rounded-full bg-signal-amber" />
            </span>
            Updated {formatTimestamp(generatedAt)}
          </span>
          <button
            onClick={toggleTranslation}
            className="flex items-center gap-1.5 rounded-full border border-graphite-600 bg-graphite-800 px-3 py-1.5 text-paper-300 transition-colors hover:border-paper-500 hover:text-paper-100"
            title={isArabic ? "Switch to English" : "ترجم إلى العربية"}
          >
            <Languages size={14} />
            <span className="hidden sm:inline">{isArabic ? "English" : "العربية"}</span>
          </button>
        </div>
      </div>
    </header>
  )
}

