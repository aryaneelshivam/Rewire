import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboard = path.resolve(here, '../frontend/src');

// The results view reuses the dashboard's player and timeline as they are. '@' is the dashboard's own alias, so
// its imports resolve unchanged; their packages come from ../frontend/node_modules (run npm install there too).
// React is deduplicated so both sides share one copy (two Reacts break hooks).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': dashboard },
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 5174, fs: { allow: [here, dashboard, path.resolve(here, '../frontend/node_modules')] } },
});
