import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Chemin relatif : l'app reste ouvrable depuis un sous-dossier
  // (GitHub Pages) ou directement depuis le disque.
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
