# AGI Horizon Tracker

A self-updating dashboard that aggregates daily research signals from GitHub, Hugging Face, and arXiv across three frontier AI capability pillars — Autonomous Scientific R&D, Formal Mathematical Proofs, and Vast Software Systems — and translates them into plain-language forecasts.

Every data point links back to its primary source. Nothing here is taken on faith.

---

## Quick start (local preview)

```bash
npm install
npm run dev          # http://localhost:5173
```

The placeholder data in `public/data/` ships with the repo so the dashboard is fully browsable before the scraper has run.

---

## How the pipeline works

```
data/scraper.py
    → public/data/latest_data.json          (current scores + breakthroughs)
    → public/data/historical_trends.json    (trailing 90-day signal counts)

.github/workflows/daily-update.yml  — runs the scraper at midnight UTC and commits the JSON
.github/workflows/deploy.yml        — builds and deploys the React app to GitHub Pages on every push to main
```

The scraper is pure Python with a single `requests` dependency and zero external services. Each API source is wrapped in its own `try/except` so one upstream outage doesn't abort the whole run.

---

## Deploy to GitHub Pages (5 steps)

1. **Push this repo** to `github.com/<your-username>/AGI_Track` (or your fork of it).

2. **Enable Pages** → Settings → Pages → Source: **GitHub Actions**.

3. **Enable write permissions** for Actions → Settings → Actions → General → Workflow permissions → **Read and write permissions** → Save. This lets the daily-update workflow commit the refreshed JSON back to the repo.

4. **Trigger the first deploy** → Actions → "Deploy to GitHub Pages" → Run workflow. Your live URL will be `https://<your-username>.github.io/AGI_Track/`.

5. **Trigger the first data run** → Actions → "Daily AGI Signal Update" → Run workflow. From then on it runs automatically at midnight UTC.

---

## Test the scraper locally

```bash
# Dry run — uses built-in fixtures, zero network calls
python data/scraper.py --dry-run

# Live run — needs a GITHUB_TOKEN env var for better rate limits
export GITHUB_TOKEN=ghp_...
python data/scraper.py
```

---

## Project structure

```
├── data/
│   └── scraper.py                  Python data pipeline
├── public/
│   ├── data/
│   │   ├── latest_data.json        Runtime data (overwritten nightly)
│   │   └── historical_trends.json  Heatmap data (overwritten nightly)
│   └── favicon.svg
├── src/
│   ├── App.jsx                     Main dashboard layout
│   ├── index.css
│   ├── main.jsx
│   └── components/
│       ├── CapabilityCard.jsx      Four pillar cards
│       ├── ForecastMatrix.jsx      30/90/365-day forecast table
│       ├── Header.jsx
│       ├── Footer.jsx
│       ├── HeatmapWidget.jsx       GitHub-style 90-day calendar heatmap
│       ├── SignalFeed.jsx          Full-detail breakthrough feed
│       ├── TrendChart.jsx          Multi-line Recharts comparison
│       └── VerifyPalette.jsx       Copyable shell verification commands
├── .github/workflows/
│   ├── daily-update.yml            Scraper cron
│   └── deploy.yml                  GitHub Pages deploy
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## Data schema

`latest_data.json` schema every item in `breakthroughs` must satisfy (enforced by the scraper):

```json
{
  "title": "...",
  "impact": "...",
  "source_url": "...",
  "commit_hash_or_arxiv_id": "...",
  "verification_status": "verified | pending"
}
```

Scores are a transparent momentum heuristic (see `data/scraper.py → update_score()`) — not a model prediction. The formula is auditable from the source file alone.
