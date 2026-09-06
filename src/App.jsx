import { useEffect, useState } from 'react'
import { FlaskConical, Sigma, Cpu, Compass, ArrowUpRight, ArrowDownRight, Minus, Sparkles } from 'lucide-react'
import { useI18n } from './i18n.jsx'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import CapabilityCard from './components/CapabilityCard.jsx'
import HeatmapWidget from './components/HeatmapWidget.jsx'
import TrendChart from './components/TrendChart.jsx'
import ForecastMatrix from './components/ForecastMatrix.jsx'
import SignalFeed from './components/SignalFeed.jsx'
import VerifyPalette from './components/VerifyPalette.jsx'

const PILLAR_META = {
  scientific_rd: { icon: FlaskConical, accent: '#9A8CFF', shortLabel: 'Sci R&D', unit: 'papers' },
  math_proofs: { icon: Sigma, accent: '#4FD1C5', shortLabel: 'Math', unit: 'commits' },
  software_systems: { icon: Cpu, accent: '#F5A623', shortLabel: 'Software', unit: 'PRs' },
  daily_life_impact: { icon: Compass, accent: '#C7C2B8', shortLabel: 'Impact', unit: 'signals' }
}

const BASE = import.meta.env.BASE_URL

function useJson(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true })

  useEffect(() => {
    let cancelled = false
    fetch(`${BASE}${path}?t=${Date.now()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${path} responded ${res.status}`)
        return res.json()
      })
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState({ data: null, error, loading: false }))
    return () => {
      cancelled = true
    }
  }, [path])

  return state
}

function ExecutiveSummary({ summary, protocol }) {
  const { t, isArabic, translateDynamic } = useI18n()
  const [translated, setTranslated] = useState(null)

  useEffect(() => {
    if (isArabic && summary) {
      translateDynamic(summary).then(setTranslated)
    }
  }, [isArabic, summary, translateDynamic])

  if (!summary) return null

  return (
    <div className="relative overflow-hidden border border-signal-amber/20 bg-gradient-to-r from-signal-amber/[0.04] via-graphite-900/60 to-graphite-900/60">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(245,166,35,0.06),transparent_60%)]" />
      <div className="relative flex items-start gap-4 px-6 py-5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-signal-amber/10">
          <Sparkles size={16} className="text-signal-amber" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-signal-amber">
              {t('Executive Summary')}
            </span>
            {protocol && (
              <span className="rounded-full bg-graphite-800 px-2 py-0.5 font-mono text-[10px] text-paper-500">
                {protocol}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-paper-200">
            {isArabic ? (translated || summary) : summary}
          </p>
        </div>
      </div>
    </div>
  )
}

function CompositeIndex({ composite }) {
  const { t, isArabic, translateDynamic } = useI18n()
  const [translatedLabel, setTranslatedLabel] = useState(null)

  useEffect(() => {
    if (isArabic && composite?.label) {
      translateDynamic(composite.label).then(setTranslatedLabel)
    }
  }, [isArabic, composite?.label, translateDynamic])

  if (!composite) return null
  const isUp = composite.delta_7d > 0
  const isFlat = Math.abs(composite.delta_7d) < 0.05
  const DeltaIcon = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight

  return (
    <div className="border border-graphite-600 bg-graphite-900/60 px-6 py-8 sm:px-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="font-mono text-xs text-paper-500">{t('Composite horizon index')}</span>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-mono text-6xl font-medium tabular text-paper-100">{composite.score.toFixed(1)}</span>
            <span
              className={`flex items-center gap-1 font-mono text-sm ${
                isFlat ? 'text-paper-500' : isUp ? 'text-signal-cyan' : 'text-signal-rose'
              }`}
            >
              <DeltaIcon size={14} strokeWidth={2.5} />
              {Math.abs(composite.delta_7d).toFixed(1)} {t('this week')}
            </span>
          </div>
          <p className="mt-2 max-w-md text-sm text-paper-300">
            {isArabic ? (translatedLabel || composite.label) : composite.label}
          </p>
        </div>
        <p className="max-w-sm text-xs leading-relaxed text-paper-500">
          {t('Unweighted average of the three tracked pillars below, each scored 0–100 against its own historical baseline. A heuristic momentum gauge, not a forecast of arrival.')}
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const { data: latest, error: latestError, loading: latestLoading } = useJson('data/latest_data.json')
  const { data: trends } = useJson('data/historical_trends.json')
  const [activePillar, setActivePillar] = useState('math_proofs')
  const { dir, isArabic } = useI18n()

  const heatmapPillars = ['scientific_rd', 'math_proofs', 'software_systems'].map((key) => ({
    key,
    accent: PILLAR_META[key].accent,
    shortLabel: PILLAR_META[key].shortLabel,
    unit: PILLAR_META[key].unit
  }))

  const breakthroughByPillar = (key) => latest?.breakthroughs?.find((b) => b.pillar === key)

  return (
    <div className={`min-h-screen bg-graphite-950 bg-grid ${isArabic ? "font-['Thmanyah_Sans']" : ''}`} dir={dir}>
      <Header generatedAt={latest?.generated_at} isDemo={latest?.status === 'demo'} />

      <main className="mx-auto max-w-6xl px-6 py-10">
        {latestLoading && <p className="text-sm text-paper-500">Loading latest signals…</p>}

        {latestError && (
          <div className="border border-signal-rose/40 bg-signal-rose/5 px-5 py-4 text-sm text-signal-rose">
            Couldn't load <code className="font-mono">data/latest_data.json</code>. If you're running this outside{' '}
            <code className="font-mono">npm run dev</code>, make sure the file exists at{' '}
            <code className="font-mono">public/data/latest_data.json</code>.
          </div>
        )}

        {latest && (
          <div className="flex flex-col gap-6">
            <ExecutiveSummary
              summary={latest.executive_summary}
              protocol={latest.curation_protocol}
            />

            <CompositeIndex composite={latest.composite_index} />

            <section aria-label="Capability pillars" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Object.entries(latest.pillars).map(([key, pillar]) => (
                <CapabilityCard
                  key={key}
                  icon={PILLAR_META[key]?.icon ?? Compass}
                  accent={PILLAR_META[key]?.accent ?? '#C7C2B8'}
                  pillar={pillar.name}
                  score={pillar.score}
                  deltaToday={pillar.delta_today}
                  delta7d={pillar.delta_7d}
                  summary={pillar.summary}
                  everydayImpact={pillar.everyday_impact}
                  breakthrough={breakthroughByPillar(key)}
                />
              ))}
            </section>

            {trends?.days && (
              <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                <HeatmapWidget
                  history={trends.days}
                  pillars={heatmapPillars}
                  activePillar={activePillar}
                  onChangePillar={setActivePillar}
                />
                <TrendChart history={trends.days} pillars={heatmapPillars} />
              </div>
            )}

            {latest.breakthroughs && (
              <SignalFeed
                items={latest.breakthroughs}
                pillarAccents={Object.fromEntries(Object.entries(PILLAR_META).map(([k, v]) => [k, v.accent]))}
              />
            )}

            {latest.forecast && <ForecastMatrix forecast={latest.forecast} />}

            <VerifyPalette />
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
