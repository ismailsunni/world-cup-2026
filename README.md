# World Cup 2026 Data Visualizer

A front-end-only static site that visualizes 2026 FIFA World Cup data, deployed to
GitHub Pages. See [`docs/PRD.md`](docs/PRD.md) for the full product spec.

The first visualization is a per-group dot plot: each group is a line, each team a dot
positioned by a switchable metric (average squad age, number of clubs, FIFA ranking, …).

## Data

The single source of truth is **`public/data/wc2026.json`** (~452 KB: 12 groups, 48
teams, 1244 players). JSON was chosen over CSV because the browser consumes it natively,
its nested shape (groups → teams → squad) matches how the UI reads it, and it avoids the
runtime joins multiple flat CSVs would require.

`scripts/build_data.py` documents how the JSON was assembled from the upstream raw CSVs
(team, group, venue, schedule, bracket, squad tables). Those CSVs are **not** part of
this repo — the JSON is canonical. To regenerate:

```bash
RAW_DIR=/path/to/raw/csvs python3 scripts/build_data.py
```

## Stack

Vite + Vue 3 (`<script setup>`, TypeScript) + D3 for the custom dot-plot chart.

## Status

Repo bootstrap: data source + PRD are in place. App scaffolding is the next step (see PRD §6–7).
