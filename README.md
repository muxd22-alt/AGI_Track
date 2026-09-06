# AGI Horizon Tracker

A live, self-updating dashboard that aggregates daily research signals from GitHub, Hugging Face, and arXiv across three frontier AI capability pillars — **Autonomous Scientific R&D**, **Formal Mathematical Proofs**, and **Vast Software Systems** — and translates them into plain-language forecasts.

Every data point links back to its primary source. Nothing here is taken on faith.

---

## Why this matters

The AI industry is full of speculative roadmaps and hype. The **AGI Horizon Tracker** cuts through the noise by focusing exclusively on **empirical momentum**. 

Instead of tracking product announcements, it tracks the leading indicators of structural change:
* **Autonomous Scientific R&D:** Tracking when autonomous agents transition from experimental toys to routine co-authors on peer-reviewed papers.
* **Formal Mathematical Proofs:** Tracking the velocity of auto-formalization tools translating informal proofs, signaling a shift in safety-critical code verification.
* **Vast Software Systems:** Tracking autonomous coding agent PR merge rates against real-world benchmarks like SWE-bench.

By synthesizing these three highly technical pillars, the dashboard provides a grounded, data-driven forecast of how close we are to structural shifts in the labor market and research workflows.

## Verifiable and Transparent

There is no "black box" model generating these scores. The composite horizon index and pillar scores are driven by a transparent momentum heuristic evaluating the volume of primary-source evidence (commits, whitepapers, leaderboard upvotes) published each day.

Every breakthrough featured on the tracker includes:
- **Direct Source Links:** Straight to the arXiv preprint, GitHub commit, or Hugging Face paper.
- **Verification Instructions:** Explicit steps on how to reproduce or verify the claim yourself (e.g., pulling a commit and running tests).

## How the architecture works (Zero Maintenance)

The entire tracker functions as a fully automated, headless application running on GitHub's infrastructure forever for free.

```text
data/scraper.py
    → public/data/latest_data.json          (current scores + breakthroughs)
    → public/data/historical_trends.json    (trailing 90-day signal counts)
```

1. **Daily Signal Ingestion:** `data/scraper.py` runs autonomously every midnight UTC via GitHub Actions (`daily-update.yml`). It queries the APIs (saving state across runs) and calculates the new momentum scores.
2. **Atomic Data Updates:** The pipeline commits the new data directly to the `main` branch.
3. **Automated Deployment:** Committing the fresh data triggers the `deploy.yml` workflow, rebuilding the Vite/React application and pushing a live update to GitHub Pages.

Each API source is wrapped in its own resilient `try/except` handler — meaning one upstream outage never aborts the whole run and the application stays continuously live.

## Project structure

```text
├── data/
│   └── scraper.py                  Python data pipeline & heuristic engine
├── public/
│   ├── data/
│   │   ├── latest_data.json        Runtime data (overwritten nightly)
│   │   └── historical_trends.json  Heatmap data (overwritten nightly)
│   └── favicon.svg
├── src/
│   ├── App.jsx                     Main dashboard layout
│   └── components/                 Capability Cards, Heatmaps, Trend Charts, etc.
├── .github/workflows/
│   ├── daily-update.yml            Scraper cron & auto-commit pipeline
│   └── deploy.yml                  GitHub Pages deployment
└── index.html                      Vite entry point
```

## Data schema

The `latest_data.json` schema enforces a strict structure for every featured breakthrough:

```json
{
  "title": "...",
  "impact": "...",
  "source_url": "...",
  "commit_hash_or_arxiv_id": "...",
  "verification_status": "verified | pending",
  "evidence_level": "..."
}
```

Scores represent momentum against a historical baseline (calculated by `update_score()` in the scraper) — not an AI's prediction. The formula remains entirely auditable.
