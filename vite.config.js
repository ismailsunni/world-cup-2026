import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
// base must match the GitHub Pages repo path so assets resolve.
export default defineConfig({
    base: '/world-cup-2026/',
    plugins: [vue()],
});
