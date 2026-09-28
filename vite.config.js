import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 4173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/uploads': 'http://localhost:8787'
    }
  },
  build: {
    outDir: 'dist'
  }
});
