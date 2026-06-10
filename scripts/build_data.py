#!/usr/bin/env python3
"""Build the single canonical data source (public/data/wc2026.json) from the
raw upstream CSVs that originally lived in ../wc-2026.

This script documents data lineage. The CSVs are NOT part of this repo — the
generated JSON is the single source of truth the app consumes. Re-run only if
you have the raw CSVs available, pointing RAW_DIR at them.
"""
import csv
import json
import os

RAW_DIR = os.environ.get("RAW_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "wc-2026"))
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data", "wc2026.json")


def read_csv(name, bom=False):
    path = os.path.join(RAW_DIR, name)
    enc = "utf-8-sig" if bom else "utf-8"
    with open(path, encoding=enc) as f:
        return list(csv.DictReader(f))


def b(v):
    return str(v).strip().lower() == "true"


def i(v):
    return int(v) if str(v).strip() not in ("", "None") else None


def main():
    teams = {t["team"]: t for t in read_csv("wc2026_teams.csv")}
    groups_rows = read_csv("wc2026_groups.csv")
    squads = read_csv("wc2026_squads.csv", bom=True)

    # squad players grouped by team name
    by_team = {}
    for p in squads:
        by_team.setdefault(p["team"], []).append({
            "shirt_number": i(p["shirt_number"]),
            "position": p["position"],
            "name": p["player_name"],
            "captain": b(p["captain"]),
            "date_of_birth": p["date_of_birth"],
            "age": i(p["age"]),
            "caps": i(p["caps"]),
            "goals": i(p["goals"]),
            "club": p["club"],
        })

    groups = {}
    for g in groups_rows:
        name = g["group"]
        t = teams.get(g["team"], {})
        groups.setdefault(name, []).append({
            "team": g["team"],
            "draw_position": i(g["draw_position"]),
            "confederation": g["confederation"],
            "fifa_ranking": i(g["fifa_ranking"]),
            "host": b(g["host"]),
            "debut": b(g["debut"]),
            "wc_appearances_prev": i(t.get("wc_appearances_prev", "")) if t else None,
            "pot": i(t.get("pot", "")) if t else None,
            "coach": t.get("coach"),
            "squad": by_team.get(g["team"], []),
        })

    venues = read_csv("wc2026_venues.csv")
    for v in venues:
        v["capacity"] = i(v["capacity"])
        v["indoor"] = b(v["indoor"])
        v["final"] = b(v["final"])

    schedule = read_csv("wc2026_schedule.csv")
    for m in schedule:
        m["match_no"] = i(m["match_no"])

    bracket = read_csv("wc2026_bracket.csv")
    for m in bracket:
        m["match_no"] = i(m["match_no"])
        m["feeds_into"] = i(m["feeds_into"])

    data = {
        "metadata": {
            "tournament": "2026 FIFA World Cup",
            "host_countries": ["Canada", "Mexico", "United States"],
            "dates": "June 11 – July 19, 2026",
            "total_teams": 48,
            "total_matches": 104,
            "groups": 12,
            "defending_champion": "Argentina",
        },
        "venues": venues,
        "groups": [{"group": k, "teams": groups[k]} for k in sorted(groups)],
        "schedule": schedule,
        "bracket": bracket,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Wrote {OUT}: {len(data['groups'])} groups, "
          f"{sum(len(g['teams']) for g in data['groups'])} teams, "
          f"{len(squads)} players")


if __name__ == "__main__":
    main()
