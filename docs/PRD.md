# PRD — World Cup 2026 Data Visualizer

**Status:** Draft · **Owner:** ismail.sunni@camptocamp.com · **Last updated:** 2026-06-11

## 1. Summary

A front-end-only static website that visualizes 2026 FIFA World Cup data. It ships
as a single-page app deployed to GitHub Pages. There is no backend; all data is
read from one bundled JSON file at runtime.

The first (and initial only) visualization is a **per-group dot plot**: each of the
12 groups is rendered as a horizontal line, and the 4 teams in that group are placed
as dots along the line according to a selected metric. A **metric switcher** lets the
user change which value drives dot positions (average squad age, number of distinct
clubs, etc.). The set of metrics is expected to grow over time.

## 2. Goals / Non-goals

**Goals**
- Static, free-to-host site on GitHub Pages, deployed automatically via GitHub Actions.
- One canonical data source — no runtime joins across multiple files.
- A group dot-plot view with a runtime-switchable metric.
- Metrics are easy to add (one new entry, no chart rewrites).

**Non-goals (for v1)**
- No backend, database, auth, or live score feeds.
- No data editing in the UI; data is read-only.
- No other views (bracket, schedule, map) yet — but the data model must not block them.

## 3. Stack ("the usual stack")

| Concern | Choice | Why |
|---|---|---|
| Build / dev server | **Vite** | Fast, first-class static build, trivial GitHub Pages `base` config. |
| Framework | **Vue 3** (`<script setup>`, Composition API) | Project default (camptocamp Vue/Nuxt house style). |
| Language | **TypeScript** | Type the data model + metric registry. |
| Charting | **D3** (`d3-scale`, `d3-selection`, `d3-axis`) | The view is a custom dot-on-a-line plot, not a stock chart type; D3 gives exact control over positioning. |
| Styling | Plain CSS / CSS modules | Small surface; no UI framework needed. |
| State | Local component state + a composable (`useData`, `useMetric`) | App is small; Pinia is overkill. |

No SSR. A plain Vue SPA built by Vite is the simplest thing that deploys cleanly to Pages.

## 4. Data — single source of truth

### Recommendation: **JSON** (not CSV)

The raw data arrived as 7 flat CSVs (`teams`, `groups`, `venues`, `schedule`,
`bracket`, `squads`) plus a partial bundled JSON. For a front-end-only app, **JSON is
the better single format**:

- **Native to the browser** — `fetch().then(r => r.json())`, no CSV parser dependency.
- **Nested, not flat** — groups → teams → squad maps directly to how the UI reads it.
  CSV would force runtime joins across `groups`, `teams`, and `squads` on every load.
- **Typed** — one `WorldCup` TypeScript interface describes the whole payload.
- **One file** — eliminates the JSON/CSV drift the raw data already had (squads missing
  from JSON; venue count mismatch 16 vs 15).

Size is **~452 KB** (12 groups, 48 teams, 1244 players) — fine to fetch once.

### Canonical file: `public/data/wc2026.json`

Built once by `scripts/build_data.py` from the upstream CSVs and committed. The CSVs are
**not** part of this repo; the JSON is the source of truth the app consumes. Shape:

```jsonc
{
  "metadata": { "tournament", "host_countries", "dates", "total_teams", "total_matches", "groups", "defending_champion" },
  "venues":  [ { "venue_id", "name", "wc_name", "city", "country", "capacity", "indoor", "region", "final" } ],
  "groups":  [ {
    "group": "A",
    "teams": [ {
      "team": "Mexico", "draw_position": 1, "confederation": "CONCACAF",
      "fifa_ranking": 15, "host": true, "debut": false,
      "wc_appearances_prev": 17, "pot": 1, "coach": "...",
      "squad": [ { "shirt_number", "position", "name", "captain", "date_of_birth", "age", "caps", "goals", "club" } ]
    } ]
  } ],
  "schedule": [ { "match_no", "round", "group", "date", "time_utc", "home", "away", "venue_id", "venue" } ],
  "bracket":  [ { "match_no", "round", "date", "team1_desc", "team2_desc", "feeds_into", "venue_id" } ]
}
```

Carrying the full `squad` per team (rather than precomputed metrics) keeps **new metrics
cheap**: a metric is just a function over a team object — no rebuild of the data file.

## 5. The visualization

**Group dot plot.** Vertical stack of 12 rows (groups A–L). Each row:
- A label (group letter) on the left.
- A horizontal line spanning a shared x-scale (the same domain across all groups so
  groups are comparable).
- 4 dots, one per team, positioned by the selected metric's value. Dots show the team
  (flag/abbreviation) and the value on hover (tooltip).
- The "range" of a group is visually the spread of its 4 dots along the line.

**Metric switcher.** A `<select>` / segmented control bound to the active metric. Changing
it re-runs the metric function for every team and animates dots to new x positions.

### Metric registry (extensible)

Each metric is one object; adding a metric = adding one entry. No chart code changes.

```ts
interface Metric {
  id: string
  label: string          // shown in the switcher
  unit?: string
  value: (team: Team) => number   // pure function over a team
  format?: (n: number) => string
}
```

v1 metrics (illustrative — more added later):
- **Average squad age** — `mean(squad.age)`
- **Number of distinct clubs** — `new Set(squad.club).size`
- **FIFA ranking** — `team.fifa_ranking`
- **Total caps**, **total goals** — sums over `squad`

x-scale domain is computed from the min/max of the active metric across all 48 teams so
the line length is meaningful and shared.

## 6. Project structure (target)

```
world-cup-2026/
├─ public/data/wc2026.json        # single canonical source (committed)
├─ src/
│  ├─ main.ts
│  ├─ App.vue
│  ├─ types.ts                    # WorldCup, Group, Team, Player interfaces
│  ├─ metrics.ts                  # Metric registry
│  ├─ composables/useData.ts      # fetch + cache the JSON
│  └─ components/
│     ├─ GroupDotPlot.vue         # the D3 chart
│     └─ MetricSwitcher.vue
├─ scripts/build_data.py          # data lineage (regenerates the JSON from raw CSVs)
├─ index.html
├─ vite.config.ts                 # base: '/world-cup-2026/'
└─ .github/workflows/deploy.yml
```

## 7. Deployment — GitHub Pages via Actions

- Vite `base` must be `'/world-cup-2026/'` (repo name) so asset URLs resolve on Pages.
- Repo Settings → Pages → Source = "GitHub Actions".
- Workflow: build on push to `main`, upload `dist/` as a Pages artifact, deploy.

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push: { branches: [main] }
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## 8. Acceptance criteria

1. `npm run dev` serves the app locally; `npm run build` produces a static `dist/`.
2. The app fetches `wc2026.json` once and renders 12 group rows with 4 dots each.
3. A switcher changes the active metric; dots reposition on a shared x-scale.
4. Adding a metric requires editing only `metrics.ts`.
5. Pushing to `main` deploys to `https://<user>.github.io/world-cup-2026/`.
6. The repo contains exactly one data source (the JSON); no CSVs are shipped.

## 9. Open questions

- Dot labels: team flags (asset set needed) vs 3-letter codes? (Default: codes for v1.)
- Should metric direction matter (e.g. lower FIFA rank = better)? Possibly invert axis per metric.
- Mobile layout for 12 stacked rows — scroll vs compact?
