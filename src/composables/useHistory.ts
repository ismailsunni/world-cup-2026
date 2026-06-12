import { ref } from 'vue'

export type HistoryResult = 'QF' | 'SF' | 'RU' | 'W'
export interface HistoryRow {
  country: string
  year: number
  result: HistoryResult
}

const data = ref<HistoryRow[] | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)
let started = false

export function useHistory() {
  if (!started) {
    started = true
    loading.value = true
    fetch(`${import.meta.env.BASE_URL}data/quarter-history.csv`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then((text) => {
        const lines = text.trim().split(/\r?\n/)
        const rows: HistoryRow[] = []
        for (let i = 1; i < lines.length; i++) {
          const [country, year, result] = lines[i].split(',')
          if (!country) continue
          rows.push({
            country: country.trim(),
            year: Number(year),
            result: result.trim() as HistoryResult,
          })
        }
        data.value = rows
      })
      .catch((e: unknown) => {
        error.value = e instanceof Error ? e.message : String(e)
      })
      .finally(() => {
        loading.value = false
      })
  }
  return { data, error, loading }
}
