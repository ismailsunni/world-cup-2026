export interface Player {
  shirt_number: number | null
  position: string
  name: string
  captain: boolean
  date_of_birth: string
  age: number | null
  caps: number | null
  goals: number | null
  club: string
}

export interface Team {
  team: string
  draw_position: number | null
  confederation: string
  fifa_ranking: number | null
  host: boolean
  debut: boolean
  wc_appearances_prev: number | null
  pot: number | null
  coach: string | null
  squad: Player[]
}

export interface Group {
  group: string
  teams: Team[]
}

export interface Venue {
  venue_id: string
  name: string
  wc_name: string
  city: string
  country: string
  capacity: number | null
  indoor: boolean
  region: string
  final: boolean
}

export interface WorldCup {
  metadata: {
    tournament: string
    host_countries: string[]
    dates: string
    total_teams: number
    total_matches: number
    groups: number
    defending_champion: string
  }
  venues: Venue[]
  groups: Group[]
  schedule: unknown[]
  bracket: unknown[]
}
