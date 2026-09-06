import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // If deploying to GitHub Pages under a repo (not a custom domain or a
  // <username>.github.io root repo), set base to '/<repo-name>/'.
  base: './',
  server: {
    port: 5173
  }
})
