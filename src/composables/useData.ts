import { ref } from 'vue'
import type { WorldCup } from '../types'

const data = ref<WorldCup | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)
let started = false

export function useData() {
  if (!started) {
    started = true
    loading.value = true
    // BASE_URL respects the GitHub Pages sub-path configured in vite.config.ts.
    fetch(`${import.meta.env.BASE_URL}data/wc2026.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((json: WorldCup) => {
        data.value = json
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
