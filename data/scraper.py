#!/usr/bin/env python3
"""
scraper.py — AGI Horizon Tracker data pipeline.

Pulls daily signals from three public sources — the GitHub REST API, the
Hugging Face Daily Papers API, and the arXiv API — and writes two static
JSON files consumed directly by the frontend at runtime:

    public/data/latest_data.json        current scores, breakthroughs, forecast
    public/data/historical_trends.json  trailing 90-day signal counts (heatmap)

Design goals:
  * Never hard-fail the whole run because one upstream API hiccuped.
    Each source is fetched independently and wrapped in try/except; a
    failure degrades that pillar's signal for the day rather than
    aborting the workflow.
  * Every claim keeps a `source_url` so a human can check it themselves
    (see the "Trust but Verify" requirement in the project README).
  * Scores are a simple, transparent momentum heuristic — not a model
    prediction — so they stay auditable from this file alone.

Usage:
    python data/scraper.py                      # live run, writes public/data/
    python data/scraper.py --dry-run             # no network calls, uses fixtures
    python data/scraper.py --output-dir out/     # custom output location
    python data/scraper.py --date 2026-09-02     # override "today" (testing)

Environment:
    GITHUB_TOKEN   optional; raises the GitHub API rate limit from 60/hr to
                   5,000/hr. Already set automatically inside GitHub Actions.
    HF_TOKEN       optional; Hugging Face daily papers API works without it.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

USER_AGENT = "agi-horizon-tracker/1.0 (+https://github.com/muxd22-alt/AGI_Track)"
GITHUB_API = "https://api.github.com"
HF_DAILY_PAPERS_API = "https://huggingface.co/api/daily_papers"
ARXIV_API = "http://export.arxiv.org/api/query"
ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}

REQUEST_TIMEOUT = 20

PILLARS = ["scientific_rd", "math_proofs", "software_systems"]

PILLAR_NAMES = {
    "scientific_rd": "Autonomous Scientific R&D",
    "math_proofs": "Formal Mathematical Proofs",
    "software_systems": "Vast Software Systems",
}

# Keyword filters used to decide whether an arXiv/HF item is "about" a
# pillar. Deliberately simple (substring match) so the whole pipeline is
# auditable without a model in the loop — swap in something smarter
# (embeddings, an LLM classifier) as the project matures.
KEYWORDS = {
    "scientific_rd": [
        "autonomous agent", "agentic", "ai scientist", "hypothesis generation",
        "world model", "multi-agent", "scientific discovery", "automated research",
    ],
    "math_proofs": [
        "lean 4", "lean4", "mathlib", "theorem prov", "formal verification",
        "autoformalization", "auto-formalization", "formal proof", "isabelle", "coq",
    ],
    "software_systems": [
        "swe-bench", "software engineering agent", "coding agent", "code agent",
        "autonomous software", "pull request", "self-debugging", "program synthesis",
    ],
}

# Fixed, human-authored translations of "what this pillar's progress means
# day to day." Kept static rather than scraped — this is interpretation,
# not a fact the APIs can hand back.
EVERYDAY_IMPACT = {
    "scientific_rd": (
        "When autonomous agents routinely appear as listed co-authors on "
        "peer-reviewed papers, expect literature-review and first-draft-hypothesis "
        "work to shift toward human verification rather than human generation."
    ),
    "math_proofs": (
        "When auto-formalization tools reliably translate informal proofs into "
        "Lean without expert supervision, expect formal verification to become a "
        "standard CI step for safety-critical code, not a specialist niche."
    ),
    "software_systems": (
        "When agent PR merge rates on real-world repos approach human baselines "
        "on SWE-bench Verified, expect junior-engineer hiring to tilt further "
        "toward review and system-design skills over greenfield implementation."
    ),
}

DEFAULT_SCORES = {"scientific_rd": 25.0, "math_proofs": 25.0, "software_systems": 25.0}


# --------------------------------------------------------------------------
# Fetchers — one function per source. Each raises on failure; callers decide
# how to degrade.
# --------------------------------------------------------------------------

def github_headers(token: str | None) -> dict:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": USER_AGENT}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def fetch_github_search_repos(query: str, token: str | None, per_page: int = 5) -> list[dict]:
    """Search repositories, e.g. query='topic:coding-agent'."""
    resp = requests.get(
        f"{GITHUB_API}/search/repositories",
        params={"q": query, "sort": "updated", "order": "desc", "per_page": per_page},
        headers=github_headers(token),
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json().get("items", [])


def fetch_github_recent_commits(owner_repo: str, token: str | None, since_hours: int = 24) -> list[dict]:
    """Recent commits on a specific repo — used for the verifiable Mathlib4 signal."""
    since = (datetime.now(timezone.utc) - timedelta(hours=since_hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
    resp = requests.get(
        f"{GITHUB_API}/repos/{owner_repo}/commits",
        params={"since": since, "per_page": 50},
        headers=github_headers(token),
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_arxiv(search_query: str, max_results: int = 8) -> list[dict]:
    """Query the arXiv Atom API. Blocking 3s sleep after the call per arXiv's
    rate-limit etiquette (https://info.arxiv.org/help/api/tou.html)."""
    resp = requests.get(
        ARXIV_API,
        params={
            "search_query": search_query,
            "start": 0,
            "max_results": max_results,
            "sortBy": "submittedDate",
            "sortOrder": "descending",
        },
        headers={"User-Agent": USER_AGENT},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    root = ET.fromstring(resp.text)
    entries = []
    for entry in root.findall("atom:entry", ATOM_NS):
        entries.append({
            "id": (entry.findtext("atom:id", default="", namespaces=ATOM_NS) or "").strip(),
            "title": " ".join((entry.findtext("atom:title", default="", namespaces=ATOM_NS) or "").split()),
            "summary": " ".join((entry.findtext("atom:summary", default="", namespaces=ATOM_NS) or "").split()),
            "published": entry.findtext("atom:published", default="", namespaces=ATOM_NS),
        })
    time.sleep(3)
    return entries


def fetch_hf_daily_papers(target_date: str, limit: int = 20) -> list[dict]:
    """Hugging Face Daily Papers for a given YYYY-MM-DD date. Public, no auth
    required. Response shape has varied between a bare list and a
    {"results": [...]} wrapper historically, so both are handled."""
    resp = requests.get(
        HF_DAILY_PAPERS_API,
        params={"date": target_date, "limit": limit},
        headers={"User-Agent": USER_AGENT},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    payload = resp.json()
    items = payload.get("results", payload) if isinstance(payload, dict) else payload

    papers = []
    for item in items or []:
        paper = item.get("paper", item) if isinstance(item, dict) else {}
        arxiv_id = paper.get("id") or item.get("id") or ""
        papers.append({
            "arxiv_id": arxiv_id,
            "title": paper.get("title", item.get("title", "")),
            "summary": paper.get("summary", paper.get("abstract", "")),
            "upvotes": paper.get("upvotes", item.get("upvotes", 0)) or 0,
            "url": f"https://huggingface.co/papers/{arxiv_id}" if arxiv_id else item.get("url", ""),
        })
    return papers


# --------------------------------------------------------------------------
# Fixtures for --dry-run, so the pipeline is testable with zero network
# access (useful in CI debugging or offline development).
# --------------------------------------------------------------------------

def fixture_github_repos(_query, _token=None, per_page=5):
    return [{
        "full_name": "example-org/agentic-research-loop",
        "html_url": "https://github.com/example-org/agentic-research-loop",
        "description": "[Fixture] An example autonomous-agent repo for dry-run testing.",
        "pushed_at": "2026-09-02T03:00:00Z",
        "stargazers_count": 412,
    }][:per_page]


def fixture_github_commits(_owner_repo, _token=None, since_hours=24):
    return [{
        "sha": "0123456789abcdef0123456789abcdef01234567",
        "html_url": "https://github.com/leanprover-community/mathlib4/commit/0123456",
        "commit": {"message": "[Fixture] feat: add lemma for dry-run testing", "author": {"date": "2026-09-02T02:00:00Z"}},
    }]


def fixture_arxiv(_query, max_results=8):
    return [{
        "id": "https://arxiv.org/abs/0000.00000",
        "title": "[Fixture] An Example Paper for Dry-Run Testing",
        "summary": "This is fixture summary text standing in for a real arXiv abstract during a dry run.",
        "published": "2026-09-02T00:00:00Z",
    }][:max_results]


def fixture_hf_papers(_target_date, limit=20):
    return [{
        "arxiv_id": "0000.00001",
        "title": "[Fixture] An Example Hugging Face Daily Paper",
        "summary": "Fixture summary text for a Hugging Face daily paper used in dry-run mode.",
        "upvotes": 12,
        "url": "https://huggingface.co/papers/0000.00001",
    }][:limit]


# --------------------------------------------------------------------------
# Scoring
# --------------------------------------------------------------------------

def clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def rolling_average(days: list[dict], pillar: str, window: int = 14) -> float:
    recent = days[-window:] if len(days) >= 1 else []
    if not recent:
        return 0.0
    return sum(d.get(pillar, 0) for d in recent) / len(recent)


def update_score(prev_score: float, todays_count: int, avg_count: float) -> tuple[float, float]:
    """Simple bounded momentum heuristic: score moves toward today's count
    relative to its own recent baseline, capped so no single day swings the
    needle by more than 2 points in either direction."""
    if avg_count <= 0:
        delta = 0.3 if todays_count > 0 else 0.0
    else:
        raw = 1.5 * ((todays_count - avg_count) / max(avg_count, 1.0))
        delta = max(-2.0, min(2.0, raw))
    new_score = clamp(round(prev_score + delta, 1))
    return new_score, round(delta, 2)


def impact_bucket(delta_7d_sum: float) -> str:
    if delta_7d_sum >= 6:
        return "Critical"
    if delta_7d_sum >= 3:
        return "High"
    if delta_7d_sum >= 1:
        return "Medium"
    return "Low"


# --------------------------------------------------------------------------
# Pipeline assembly
# --------------------------------------------------------------------------

def build_breakthrough(pillar: str, arxiv_items, hf_items, gh_repos, gh_commits) -> dict | None:
    keywords = KEYWORDS[pillar]

    def matches(text: str) -> bool:
        text = (text or "").lower()
        return any(k in text for k in keywords)

    # math_proofs gets first crack at a directly-verifiable GitHub commit —
    # code you can `lake build` yourself beats any unverified claim.
    if pillar == "math_proofs" and gh_commits:
        c = gh_commits[0]
        return {
            "pillar": pillar,
            "title": c["commit"]["message"].splitlines()[0][:140],
            "impact": "New commit activity in a core formal-verification repository.",
            "source_url": c["html_url"],
            "commit_hash_or_arxiv_id": c["sha"][:12],
            "verification_status": "verified",
            "evidence_level": "Working Code Repo",
            "core_innovation": c["commit"]["message"].splitlines()[0][:280],
            "what_it_means": EVERYDAY_IMPACT[pillar],
            "how_to_verify": "Clone the repo, checkout this commit, and run `lake build` to confirm the kernel accepts it.",
        }

    for paper in arxiv_items:
        if matches(paper["title"]) or matches(paper["summary"]):
            return {
                "pillar": pillar,
                "title": paper["title"][:160],
                "impact": "Matched pillar keywords in a recent arXiv submission.",
                "source_url": paper["id"],
                "commit_hash_or_arxiv_id": paper["id"].rsplit("/", 1)[-1],
                "verification_status": "pending",
                "evidence_level": "Unverified Claim",
                "core_innovation": paper["summary"][:400],
                "what_it_means": EVERYDAY_IMPACT[pillar],
                "how_to_verify": "Open the arXiv listing and check the methods section and author affiliations.",
            }

    for paper in hf_items:
        if matches(paper["title"]) or matches(paper["summary"]):
            return {
                "pillar": pillar,
                "title": paper["title"][:160],
                "impact": f"Trending on Hugging Face Daily Papers ({paper['upvotes']} upvotes).",
                "source_url": paper["url"],
                "commit_hash_or_arxiv_id": paper["arxiv_id"] or "n/a",
                "verification_status": "pending",
                "evidence_level": "Unverified Claim",
                "core_innovation": (paper["summary"] or "")[:400],
                "what_it_means": EVERYDAY_IMPACT[pillar],
                "how_to_verify": "Check the paper's Hugging Face page for linked code or model weights and try reproducing its headline result.",
            }

    if gh_repos:
        r = gh_repos[0]
        return {
            "pillar": pillar,
            "title": f"Repository activity: {r['full_name']}",
            "impact": r.get("description") or "Recently updated repository matching this pillar's tracked topics.",
            "source_url": r["html_url"],
            "commit_hash_or_arxiv_id": "n/a",
            "verification_status": "pending",
            "evidence_level": "Working Code Repo",
            "core_innovation": r.get("description") or "See repository README for details.",
            "what_it_means": EVERYDAY_IMPACT[pillar],
            "how_to_verify": "Clone the repository and check its test suite, CI status, and recent commit history.",
        }

    return None


def run(output_dir: Path, target_date: str, github_token: str | None, dry_run: bool) -> None:
    if dry_run:
        gh_search, gh_commits_fn, arxiv_fn, hf_fn = (
            fixture_github_repos, fixture_github_commits, fixture_arxiv, fixture_hf_papers,
        )
    else:
        gh_search, gh_commits_fn, arxiv_fn, hf_fn = (
            fetch_github_search_repos, fetch_github_recent_commits, fetch_arxiv, fetch_hf_daily_papers,
        )

    # --- Fetch, isolating failures per source -----------------------------
    arxiv_by_pillar, hf_by_pillar, gh_repos_by_pillar = {}, {}, {}
    gh_mathlib_commits = []

    arxiv_queries = {
        "scientific_rd": "cat:cs.AI+AND+(agentic+OR+autonomous)",
        "math_proofs": "cat:math.LO+AND+(formalization+OR+lean)",
        "software_systems": "cat:cs.SE+AND+(agent+OR+swe-bench)",
    }
    gh_queries = {
        "scientific_rd": "topic:autonomous-agents+sort:updated",
        "math_proofs": "topic:theorem-proving+sort:updated",
        "software_systems": "topic:coding-agent+sort:updated",
    }

    for pillar in PILLARS:
        try:
            arxiv_by_pillar[pillar] = arxiv_fn(arxiv_queries[pillar])
        except Exception as exc:  # noqa: BLE001 — degrade, don't crash the run
            print(f"[warn] arXiv fetch failed for {pillar}: {exc}", file=sys.stderr)
            arxiv_by_pillar[pillar] = []

        try:
            gh_repos_by_pillar[pillar] = gh_search(gh_queries[pillar], github_token) if not dry_run else gh_search(gh_queries[pillar])
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] GitHub search failed for {pillar}: {exc}", file=sys.stderr)
            gh_repos_by_pillar[pillar] = []

    try:
        hf_papers = hf_fn(target_date) if not dry_run else hf_fn(target_date)
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] Hugging Face fetch failed: {exc}", file=sys.stderr)
        hf_papers = []
    for pillar in PILLARS:
        hf_by_pillar[pillar] = hf_papers

    try:
        gh_mathlib_commits = gh_commits_fn("leanprover-community/mathlib4", github_token) if not dry_run else gh_commits_fn("leanprover-community/mathlib4")
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] GitHub commits fetch failed: {exc}", file=sys.stderr)
        gh_mathlib_commits = []

    # --- Load previous state for score persistence -------------------------
    latest_path = output_dir / "latest_data.json"
    history_path = output_dir / "historical_trends.json"

    prev_scores = dict(DEFAULT_SCORES)
    if latest_path.exists():
        try:
            prev = json.loads(latest_path.read_text())
            for p in PILLARS:
                prev_scores[p] = prev.get("pillars", {}).get(p, {}).get("score", DEFAULT_SCORES[p])
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] could not read previous latest_data.json: {exc}", file=sys.stderr)

    history = {"description": (
        "Daily signal counts per pillar over the trailing 90 days. Overwritten "
        "nightly by data/scraper.py."
    ), "days": []}
    if history_path.exists():
        try:
            history = json.loads(history_path.read_text())
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] could not read previous historical_trends.json: {exc}", file=sys.stderr)

    # --- Today's raw counts, then update scores -----------------------------
    todays_counts = {
        "scientific_rd": len(arxiv_by_pillar["scientific_rd"]) + len(hf_by_pillar["scientific_rd"]),
        "math_proofs": len(gh_mathlib_commits) + len(arxiv_by_pillar["math_proofs"]),
        "software_systems": len(gh_repos_by_pillar["software_systems"]) + len(arxiv_by_pillar["software_systems"]),
    }

    days = [d for d in history.get("days", []) if d.get("date") != target_date]
    days.append({"date": target_date, **todays_counts})
    days.sort(key=lambda d: d["date"])
    days = days[-90:]
    history["days"] = days

    pillars_out = {}
    for pillar in PILLARS:
        avg = rolling_average(days[:-1], pillar) if len(days) > 1 else 0.0
        new_score, delta_today = update_score(prev_scores[pillar], todays_counts[pillar], avg)
        delta_7d = round(sum(d.get(pillar, 0) for d in days[-7:]) - sum(d.get(pillar, 0) for d in days[-14:-7] or days[-7:]), 1)
        pillars_out[pillar] = {
            "name": PILLAR_NAMES[pillar],
            "score": new_score,
            "delta_today": delta_today,
            "delta_7d": delta_7d,
            "summary": f"{todays_counts[pillar]} new {pillar.replace('_', ' ')} signal(s) detected today across tracked sources.",
            "everyday_impact": EVERYDAY_IMPACT[pillar],
        }

    pillars_out["daily_life_impact"] = {
        "name": "Forecast & Daily Life Impact",
        "score": None,
        "delta_today": None,
        "delta_7d": None,
        "summary": "Not a scraped signal — this pillar synthesizes the three technical scores above into a plain-language forecast. See the Forecast Matrix section.",
    }

    breakthroughs = []
    for pillar in PILLARS:
        b = build_breakthrough(
            pillar,
            arxiv_by_pillar[pillar],
            hf_by_pillar[pillar],
            gh_repos_by_pillar[pillar],
            gh_mathlib_commits if pillar == "math_proofs" else [],
        )
        if b:
            breakthroughs.append(b)

    composite_score = round(sum(pillars_out[p]["score"] for p in PILLARS) / len(PILLARS), 1)
    prev_composite = round(sum(prev_scores[p] for p in PILLARS) / len(PILLARS), 1)
    composite_delta_7d = round(composite_score - prev_composite, 1)

    leader = max(PILLARS, key=lambda p: pillars_out[p]["delta_7d"])
    bucket = impact_bucket(sum(pillars_out[p]["delta_7d"] for p in PILLARS))

    latest_data = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "status": "dry-run" if dry_run else "live",
        "composite_index": {
            "score": composite_score,
            "delta_7d": composite_delta_7d,
            "label": f"Momentum currently led by {PILLAR_NAMES[leader]}",
        },
        "pillars": pillars_out,
        "breakthroughs": breakthroughs,
        "forecast": {
            "30_days": {
                "milestone": f"Continued near-term movement expected in {PILLAR_NAMES[leader]}, the pillar with the strongest 7-day trend.",
                "impact_index": bucket,
            },
            "90_days": {
                "milestone": "Watch for a second pillar's trend to accelerate as tooling built on today's leading signal matures.",
                "impact_index": "High" if bucket in ("High", "Critical") else "Medium",
            },
            "365_days": {
                "milestone": "Structural shifts in the labor market or research workflow become visible only if today's momentum holds for multiple quarters — treat this row as speculative.",
                "impact_index": "Critical",
            },
        },
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    latest_path.write_text(json.dumps(latest_data, indent=2) + "\n")
    history_path.write_text(json.dumps(history, indent=2) + "\n")

    print(f"Wrote {latest_path} and {history_path}")
    print(f"Composite score: {composite_score} (Δ7d {composite_delta_7d:+})")
    for p in PILLARS:
        print(f"  {p}: {pillars_out[p]['score']} (today {todays_counts[p]} signals)")


def main() -> None:
    parser = argparse.ArgumentParser(description="AGI Horizon Tracker data pipeline")
    parser.add_argument("--output-dir", default="public/data", type=Path)
    parser.add_argument("--date", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    parser.add_argument("--github-token", default=None, help="Defaults to $GITHUB_TOKEN")
    parser.add_argument("--dry-run", action="store_true", help="Use fixtures instead of live network calls")
    args = parser.parse_args()

    import os
    token = args.github_token or os.environ.get("GITHUB_TOKEN")

    run(args.output_dir, args.date, token, args.dry_run)


if __name__ == "__main__":
    main()
