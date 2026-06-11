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

# Current FIFA world ranking (June 2026). The raw CSVs left 6 late qualifiers
# blank and were otherwise a stale, internally-inconsistent snapshot, so we
# override the whole column with one consistent release.
# Sources: football-ranking.com (10 Jun 2026, top 50) + Sofascore (sub-50).
FIFA_RANK = {
    "Argentina": 1, "Spain": 2, "France": 3, "England": 4, "Portugal": 5,
    "Brazil": 6, "Morocco": 7, "Netherlands": 8, "Belgium": 9, "Germany": 10,
    "Croatia": 11, "Colombia": 13, "Mexico": 14, "Senegal": 15, "Uruguay": 16,
    "United States": 17, "Japan": 18, "Switzerland": 19, "Iran": 21, "Turkey": 22,
    "Ecuador": 23, "Austria": 24, "South Korea": 25, "Australia": 27, "Algeria": 28,
    "Egypt": 29, "Canada": 30, "Norway": 31, "Ivory Coast": 33, "Panama": 34,
    "Sweden": 38, "Czech Republic": 39, "Paraguay": 40, "Scotland": 42, "DR Congo": 45,
    "Tunisia": 46, "Uzbekistan": 50, "Qatar": 55, "Iraq": 56, "South Africa": 60,
    "Saudi Arabia": 61, "Jordan": 63, "Bosnia and Herzegovina": 64, "Cape Verde": 69,
    "Ghana": 74, "Curaçao": 82, "Haiti": 83, "New Zealand": 85,
}

# World Football Elo ratings + global rank, via Wikipedia's
# Module:SportsRankings/data/World_Football_Elo_Ratings (updated 1 Jun 2026).
# (team: (elo_rank, elo_rating))
ELO = {
    "Spain": (1, 2165), "Argentina": (2, 2113), "France": (3, 2081), "England": (4, 2020),
    "Brazil": (5, 1988), "Portugal": (6, 1984), "Colombia": (7, 1977), "Netherlands": (8, 1961),
    "Ecuador": (9, 1935), "Croatia": (10, 1930), "Germany": (11, 1925), "Norway": (12, 1917),
    "Turkey": (13, 1906), "Japan": (14, 1906), "Switzerland": (15, 1894), "Uruguay": (16, 1892),
    "Mexico": (18, 1868), "Belgium": (19, 1866), "Senegal": (19, 1866), "Paraguay": (22, 1833),
    "Austria": (23, 1830), "Morocco": (24, 1822), "Canada": (25, 1793), "Australia": (27, 1775),
    "Scotland": (28, 1770), "Iran": (31, 1764), "South Korea": (32, 1756), "Algeria": (34, 1743),
    "United States": (36, 1733), "Panama": (36, 1733), "Czech Republic": (36, 1733),
    "Uzbekistan": (40, 1718), "Sweden": (41, 1714), "Egypt": (46, 1699), "Jordan": (51, 1685),
    "Ivory Coast": (52, 1676), "DR Congo": (54, 1655), "Tunisia": (59, 1633), "Iraq": (63, 1608),
    "Bosnia and Herzegovina": (66, 1591), "New Zealand": (68, 1585), "Cape Verde": (69, 1576),
    "Saudi Arabia": (72, 1566), "Haiti": (76, 1532), "South Africa": (79, 1517),
    "Ghana": (82, 1503), "Curaçao": (91, 1433), "Qatar": (96, 1423),
}


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
        elo = ELO.get(g["team"], (None, None))
        groups.setdefault(name, []).append({
            "team": g["team"],
            "draw_position": i(g["draw_position"]),
            "confederation": g["confederation"],
            "fifa_ranking": FIFA_RANK.get(g["team"], i(g["fifa_ranking"])),
            "elo_rank": elo[0],
            "elo_rating": elo[1],
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
