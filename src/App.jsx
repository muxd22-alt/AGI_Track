import { useEffect, useState } from 'react'
import {
  FlaskConical,
  Sigma,
  Cpu,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Activity,
  Layers,
  TrendingUp,
  Target,
  ShieldCheck,
  Zap
} from 'lucide-react'
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

function SectionHeader({ icon: Icon, title, badge }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-between border-b border-graphite-800 pb-3 pt-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded border border-graphite-700 bg-graphite-900/80 text-signal-amber">
          <Icon size={15} strokeWidth={2} />
        </div>
        <h2 className="font-mono text-sm font-semibold tracking-wide text-paper-100 uppercase">
          {t(title)}
        </h2>
      </div>
      {badge && (
        <span className="font-mono text-[10px] uppercase tracking-wider text-paper-500 bg-graphite-900 border border-graphite-700 px-2 py-0.5 rounded">
          {t(badge)}
        </span>
      )}
    </div>
  )
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
    <div className="relative overflow-hidden border border-signal-amber/30 bg-gradient-to-br from-signal-amber/[0.08] via-graphite-900/90 to-graphite-950 p-6 shadow-[0_0_30px_rgba(245,166,35,0.05)]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,166,35,0.12),transparent_70%)]" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-signal-amber/30 bg-signal-amber/10 shadow-[0_0_15px_rgba(245,166,35,0.2)]">
            <Sparkles size={18} className="text-signal-amber" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal-amber">
                {t('Executive Summary')}
              </span>
              {protocol && (
                <span className="rounded-full border border-graphite-700 bg-graphite-800/80 px-2.5 py-0.5 font-mono text-[10px] text-paper-400">
                  {protocol}
                </span>
              )}
            </div>
            <p className="mt-2.5 text-base leading-relaxed font-medium text-paper-100">
              {isArabic ? (translated || summary) : summary}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function CompositeIndex({ composite, totalSignals, leadingPillarName }) {
  const { t, isArabic, translateDynamic } = useI18n()
  const [translatedLabel, setTranslatedLabel] = useState(null)
  const [translatedLeading, setTranslatedLeading] = useState(null)

  useEffect(() => {
    if (isArabic) {
      if (composite?.label) translateDynamic(composite.label).then(setTranslatedLabel)
      if (leadingPillarName) translateDynamic(leadingPillarName).then(setTranslatedLeading)
    }
  }, [isArabic, composite?.label, leadingPillarName, translateDynamic])

  if (!composite) return null
  const isUp = composite.delta_7d > 0
  const isFlat = Math.abs(composite.delta_7d) < 0.05
  const DeltaIcon = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      {/* Primary Metric Score Card */}
      <div className="border border-graphite-600 bg-graphite-900/60 p-6 sm:p-7 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-paper-500 uppercase tracking-wider">{t('Composite horizon index')}</span>
            <span className="inline-flex items-center gap-1 border border-signal-cyan/30 bg-signal-cyan/10 px-2 py-0.5 font-mono text-[11px] text-signal-cyan">
              <Zap size={11} /> Live Benchmark
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-4">
            <span className="font-mono text-6xl sm:text-7xl font-bold tabular tracking-tight text-paper-100">
              {composite.score.toFixed(1)}
            </span>
            <div className="flex flex-col">
              <span
                className={`flex items-center gap-1 font-mono text-base font-medium ${
                  isFlat ? 'text-paper-500' : isUp ? 'text-signal-cyan' : 'text-signal-rose'
                }`}
              >
                <DeltaIcon size={18} strokeWidth={2.5} />
                {Math.abs(composite.delta_7d).toFixed(1)} {t('this week')}
              </span>
              <span className="font-mono text-xs text-paper-500">7-Day Trajectory</span>
            </div>
          </div>
          <p className="mt-3 text-sm text-paper-300 font-medium">
            {isArabic ? (translatedLabel || composite.label) : composite.label}
          </p>
        </div>
        <p className="mt-6 border-t border-graphite-800 pt-4 text-xs leading-relaxed text-paper-500">
          {t('Unweighted average of the three tracked pillars below, each scored 0–100 against its own historical baseline. A heuristic momentum gauge, not a forecast of arrival.')}
        </p>
      </div>

      {/* BI KPI Strip */}
      <div className="grid grid-rows-3 gap-3">
        <div className="border border-graphite-700 bg-graphite-900/40 p-4 flex items-center justify-between">
          <div>
            <span className="font-mono text-[11px] text-paper-500 block">{t('Total Daily Signals')}</span>
            <span className="font-mono text-2xl font-semibold text-paper-100">{totalSignals ?? '--'}</span>
          </div>
          <Activity size={20} className="text-signal-amber opacity-80" />
        </div>

        <div className="border border-graphite-700 bg-graphite-900/40 p-4 flex items-center justify-between">
          <div>
            <span className="font-mono text-[11px] text-paper-500 block">{t('Leading Pillar')}</span>
            <span className="font-mono text-sm font-medium text-signal-cyan truncate max-w-[200px] block">
              {isArabic ? (translatedLeading || leadingPillarName) : leadingPillarName}
            </span>
          </div>
          <TrendingUp size={20} className="text-signal-cyan opacity-80" />
        </div>

        <div className="border border-graphite-700 bg-graphite-900/40 p-4 flex items-center justify-between">
          <div>
            <span className="font-mono text-[11px] text-paper-500 block">{t('Data Confidence')}</span>
            <span className="font-mono text-xs font-semibold text-emerald-400">
              {t('High (Source-Grounded)')}
            </span>
          </div>
          <ShieldCheck size={20} className="text-emerald-400 opacity-80" />
        </div>
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

  // Calculate total signals today across pillars
  const totalSignalsToday = latest?.pillars
    ? Object.entries(latest.pillars).reduce((acc, [k, p]) => {
        if (k === 'daily_life_impact') return acc
        const match = p.summary?.match(/(\d+)\s+new/)
        return acc + (match ? parseInt(match[1], 10) : 0)
      }, 0)
    : 27

  // Leading pillar name
  const leadingKey = latest?.pillars
    ? Object.keys(latest.pillars).reduce((a, b) =>
        (latest.pillars[a]?.delta_7d ?? 0) > (latest.pillars[b]?.delta_7d ?? 0) ? a : b
      )
    : 'software_systems'
  const leadingPillarName = latest?.pillars?.[leadingKey]?.name ?? 'Vast Software Systems'

  return (
    <div className={`min-h-screen bg-graphite-950 bg-grid ${isArabic ? "font-['Thmanyah_Sans']" : ''}`} dir={dir}>
      <Header generatedAt={latest?.generated_at} isDemo={latest?.status === 'demo'} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {latestLoading && <p className="text-sm text-paper-500 font-mono">Loading latest signals…</p>}

        {latestError && (
          <div className="border border-signal-rose/40 bg-signal-rose/5 px-5 py-4 text-sm text-signal-rose">
            Couldn't load <code className="font-mono">data/latest_data.json</code>. If you're running this outside{' '}
            <code className="font-mono">npm run dev</code>, make sure the file exists at{' '}
            <code className="font-mono">public/data/latest_data.json</code>.
          </div>
        )}

        {latest && (
          <div className="flex flex-col gap-10">
            {/* Executive Intelligence Overview */}
            <section className="flex flex-col gap-5">
              <SectionHeader icon={Activity} title="Executive Intelligence Overview" badge="BI Protocol v1.0" />
              <ExecutiveSummary
                summary={latest.executive_summary}
                protocol={latest.curation_protocol}
              />
              <CompositeIndex
                composite={latest.composite_index}
                totalSignals={totalSignalsToday}
                leadingPillarName={leadingPillarName}
              />
            </section>

            {/* Capability Pillars Grid */}
            <section className="flex flex-col gap-5">
              <SectionHeader icon={Layers} title="Pillar Capability Matrix" badge="0–100 Scores" />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              </div>
            </section>

            {/* Momentum & Velocity Analytics */}
            {trends?.days && (
              <section className="flex flex-col gap-5">
                <SectionHeader icon={TrendingUp} title="Momentum & 90-Day Trajectory" badge="Trailing 90-Days" />
                <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                  <HeatmapWidget
                    history={trends.days}
                    pillars={heatmapPillars}
                    activePillar={activePillar}
                    onChangePillar={setActivePillar}
                  />
                  <TrendChart history={trends.days} pillars={heatmapPillars} />
                </div>
              </section>
            )}

            {/* Strategic Forecast Matrix */}
            {latest.forecast && (
              <section className="flex flex-col gap-5">
                <SectionHeader icon={Target} title="Strategic Forecast Horizon" badge="Projections" />
                <ForecastMatrix forecast={latest.forecast} />
              </section>
            )}

            {/* Empirical Evidence & Verification Engine */}
            <section className="flex flex-col gap-5">
              <SectionHeader icon={ShieldCheck} title="Empirical Evidence & Verification Engine" badge="Verifiable" />
              <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                {latest.breakthroughs && (
                  <SignalFeed
                    items={latest.breakthroughs}
                    pillarAccents={Object.fromEntries(Object.entries(PILLAR_META).map(([k, v]) => [k, v.accent]))}
                  />
                )}
                <VerifyPalette />
              </div>
            </section>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
