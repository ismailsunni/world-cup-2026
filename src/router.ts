import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'

// Hash history keeps deep links (e.g. .../#/players) working on GitHub Pages
// without any server-side SPA fallback.
export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/scatter', name: 'scatter', component: () => import('./views/ScatterView.vue') },
    { path: '/numbers', name: 'numbers', component: () => import('./views/NumbersView.vue') },
    { path: '/bracket', name: 'bracket', component: () => import('./views/BracketView.vue') },
    { path: '/teams', name: 'teams', component: () => import('./views/TeamsView.vue') },
    { path: '/players', name: 'players', component: () => import('./views/PlayersView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
