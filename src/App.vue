<script setup lang="ts">
// App is a thin shell: global header + nav + routed page.
</script>

<template>
  <main class="app">
    <header>
      <router-link class="title" to="/"><h1>World Cup 2026 — Explorer</h1></router-link>
      <nav>
        <router-link to="/">Group Analytics</router-link>
        <router-link to="/scatter">Player Chart</router-link>
        <router-link to="/numbers">Squad Numbers</router-link>
        <router-link to="/bracket">Bracket</router-link>
        <router-link to="/teams">Teams</router-link>
        <router-link to="/players">Players</router-link>
      </nav>
    </header>
    <router-view />
  </main>
</template>

<style scoped>
.app {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
  font-family: system-ui, sans-serif;
  color: #111827;
}
header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem 1.25rem;
  margin-bottom: 1rem;
}
.title {
  text-decoration: none;
  color: inherit;
}
h1 {
  margin: 0;
  font-size: 1.6rem;
}
nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
nav a {
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 600;
  color: #6b7280;
  white-space: nowrap;
}
nav a:hover {
  background: #f3f4f6;
  color: #111827;
}
nav a.router-link-exact-active {
  background: #2563eb;
  color: #fff;
}

@media (max-width: 640px) {
  .app {
    padding: 1rem 0.75rem 2.5rem;
  }
  header {
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  h1 {
    font-size: 1.25rem;
  }
  nav {
    /* full-width, evenly-spread pills that wrap to as many rows as needed */
    width: 100%;
    gap: 0.3rem;
  }
  nav a {
    padding: 0.3rem 0.6rem;
    font-size: 0.82rem;
  }
}
</style>
