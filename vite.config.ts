import { defineConfig } from 'vite';

export default defineConfig({
  // Three.js сам по собі ~500 КБ, це нормально для 3D-гри
  build: { chunkSizeWarningLimit: 800 },
});
