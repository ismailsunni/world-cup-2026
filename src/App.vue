<script setup lang="ts">
// App is a thin shell: global header + routed page.
</script>

<template>
  <main class="app">
    <header>
      <router-link class="title" to="/"><h1>World Cup 2026 — Groups</h1></router-link>
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
.title {
  text-decoration: none;
  color: inherit;
}
h1 {
  margin: 0 0 0.5rem;
  font-size: 1.6rem;
}
</style>
