// Team name -> ISO 3166-1 alpha-2 code (or gb-* subdivision) used by flagcdn.
// Flag images come from https://flagcdn.com which is reliable across browsers
// (unlike regional-indicator emoji, which don't render as flags on Linux/Windows Chrome).
export const FLAG_CODE: Record<string, string> = {
  Algeria: 'dz',
  Argentina: 'ar',
  Australia: 'au',
  Austria: 'at',
  Belgium: 'be',
  'Bosnia and Herzegovina': 'ba',
  Brazil: 'br',
  Canada: 'ca',
  'Cape Verde': 'cv',
  Colombia: 'co',
  Croatia: 'hr',
  'Curaçao': 'cw',
  'Czech Republic': 'cz',
  'DR Congo': 'cd',
  Ecuador: 'ec',
  Egypt: 'eg',
  England: 'gb-eng',
  France: 'fr',
  Germany: 'de',
  Ghana: 'gh',
  Haiti: 'ht',
  Iran: 'ir',
  Iraq: 'iq',
  'Ivory Coast': 'ci',
  Japan: 'jp',
  Jordan: 'jo',
  Mexico: 'mx',
  Morocco: 'ma',
  Netherlands: 'nl',
  'New Zealand': 'nz',
  Norway: 'no',
  Panama: 'pa',
  Paraguay: 'py',
  Portugal: 'pt',
  Qatar: 'qa',
  'Saudi Arabia': 'sa',
  Scotland: 'gb-sct',
  Senegal: 'sn',
  'South Africa': 'za',
  'South Korea': 'kr',
  Spain: 'es',
  Sweden: 'se',
  Switzerland: 'ch',
  Tunisia: 'tn',
  Turkey: 'tr',
  'United States': 'us',
  Uruguay: 'uy',
  Uzbekistan: 'uz',
}

export function flagUrl(team: string, width = 40): string | null {
  const code = FLAG_CODE[team]
  return code ? `https://flagcdn.com/w${width}/${code}.png` : null
}

// Unique FIFA trigrams — a plain 3-letter slice collides (South Africa/South Korea,
// Australia/Austria, Iran/Iraq all share the same prefix).
export const TEAM_CODE: Record<string, string> = {
  Algeria: 'ALG',
  Argentina: 'ARG',
  Australia: 'AUS',
  Austria: 'AUT',
  Belgium: 'BEL',
  'Bosnia and Herzegovina': 'BIH',
  Brazil: 'BRA',
  Canada: 'CAN',
  'Cape Verde': 'CPV',
  Colombia: 'COL',
  Croatia: 'CRO',
  'Curaçao': 'CUW',
  'Czech Republic': 'CZE',
  'DR Congo': 'COD',
  Ecuador: 'ECU',
  Egypt: 'EGY',
  England: 'ENG',
  France: 'FRA',
  Germany: 'GER',
  Ghana: 'GHA',
  Haiti: 'HAI',
  Iran: 'IRN',
  Iraq: 'IRQ',
  'Ivory Coast': 'CIV',
  Japan: 'JPN',
  Jordan: 'JOR',
  Mexico: 'MEX',
  Morocco: 'MAR',
  Netherlands: 'NED',
  'New Zealand': 'NZL',
  Norway: 'NOR',
  Panama: 'PAN',
  Paraguay: 'PAR',
  Portugal: 'POR',
  Qatar: 'QAT',
  'Saudi Arabia': 'KSA',
  Scotland: 'SCO',
  Senegal: 'SEN',
  'South Africa': 'RSA',
  'South Korea': 'KOR',
  Spain: 'ESP',
  Sweden: 'SWE',
  Switzerland: 'SUI',
  Tunisia: 'TUN',
  Turkey: 'TUR',
  'United States': 'USA',
  Uruguay: 'URU',
  Uzbekistan: 'UZB',
}

export function teamCode(team: string): string {
  return TEAM_CODE[team] ?? team.slice(0, 3).toUpperCase()
}

// One color per confederation — dot borders are tinted by it (and drives the legend).
export const CONFEDERATION_COLOR: Record<string, string> = {
  AFC: '#e11d48', // rose
  CAF: '#16a34a', // green
  CONCACAF: '#0891b2', // cyan
  CONMEBOL: '#f59e0b', // amber
  OFC: '#7c3aed', // violet
  UEFA: '#2563eb', // blue
}

export const CONFEDERATIONS = Object.keys(CONFEDERATION_COLOR)

export function confColor(conf: string): string {
  return CONFEDERATION_COLOR[conf] ?? '#6b7280'
}
