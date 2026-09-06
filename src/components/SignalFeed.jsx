import { useEffect, useState } from 'react'
import { CheckCircle2, CircleDashed, ExternalLink } from 'lucide-react'
import { useI18n } from '../i18n.jsx'

const PILLAR_LABELS = {
  scientific_rd: 'Scientific R&D',
  math_proofs: 'Math Proofs',
  software_systems: 'Software Systems'
}

const VERIFICATION_STYLES = {
  verified: { icon: CheckCircle2, label: 'Verified', className: 'text-signal-cyan border-signal-cyan/40' },
  pending: { icon: CircleDashed, label: 'Pending review', className: 'text-paper-500 border-paper-500/30' }
}

function SignalItem({ item, accent }) {
  const { t, isArabic, translateDynamic } = useI18n()
  const [trInnovation, setTrInnovation] = useState(null)
  const [trMeans, setTrMeans] = useState(null)
  const [trVerify, setTrVerify] = useState(null)

  useEffect(() => {
    if (isArabic) {
      if (item.core_innovation) translateDynamic(item.core_innovation).then(setTrInnovation)
      if (item.what_it_means) translateDynamic(item.what_it_means).then(setTrMeans)
      if (item.how_to_verify) translateDynamic(item.how_to_verify).then(setTrVerify)
    }
  }, [isArabic, item, translateDynamic])

  const verification = VERIFICATION_STYLES[item.verification_status] ?? VERIFICATION_STYLES.pending
  const VerificationIcon = verification.icon

  return (
    <div className="px-5 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="border px-1.5 py-0.5 font-mono text-[10px]"
          style={{ color: accent, borderColor: `${accent}66` }}
        >
          {t(PILLAR_LABELS[item.pillar] ?? item.pillar)}
        </span>
        <span className="border border-graphite-700 px-1.5 py-0.5 font-mono text-[10px] text-paper-500">
          {t(item.evidence_level)}
        </span>
        <span className={`flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10px] ${verification.className}`}>
          <VerificationIcon size={11} />
          {t(verification.label)}
        </span>
      </div>

      <h4 className="mt-2.5 text-sm font-medium text-paper-100">{item.title}</h4>
      <p className="mt-1 text-sm leading-relaxed text-paper-300">
        {isArabic ? (trInnovation || item.core_innovation) : item.core_innovation}
      </p>

      <dl className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wide text-paper-500">{t('Human impact')}</dt>
          <dd className="mt-1 text-sm text-paper-300">
            {isArabic ? (trMeans || item.what_it_means) : item.what_it_means}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wide text-paper-500">{t('How to verify')}</dt>
          <dd className="mt-1 text-sm text-paper-300">
            {isArabic ? (trVerify || item.how_to_verify) : item.how_to_verify}
          </dd>
        </div>
      </dl>

      <a
        href={item.source_url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 font-mono text-xs text-paper-500 hover:text-signal-cyan"
      >
        {item.source_url}
        <ExternalLink size={11} />
      </a>
    </div>
  )
}

export default function SignalFeed({ items, pillarAccents }) {
  const { t } = useI18n()

  return (
    <div className="border border-graphite-600 bg-graphite-900/60">
      <header className="border-b border-graphite-700 px-5 py-4">
        <h3 className="text-sm font-medium text-paper-100">{t('Daily signals')}</h3>
        <p className="mt-0.5 text-xs text-paper-500">
          {t('Every item links to its primary source. Nothing here is taken on faith.')}
        </p>
      </header>

      <div className="divide-y divide-graphite-700">
        {items.map((item, i) => (
          <SignalItem key={i} item={item} accent={pillarAccents[item.pillar]} />
        ))}
      </div>
    </div>
  )
}
