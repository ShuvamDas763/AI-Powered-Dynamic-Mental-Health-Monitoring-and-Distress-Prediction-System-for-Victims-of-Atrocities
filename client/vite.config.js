import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Must match the server's API_PORT default in server/src/config/env.js. */
const API_PORT = process.env.API_PORT || 3001;

/**
 * Vite dev config.
 *
 * The /api proxy makes the client and server same-origin during development,
 * so the session cookie that carries the user's role just works without any
 * CORS or cross-site-cookie handling. It also means the browser talks to one
 * origin in dev and in a built deployment, so there is no environment-specific
 * base-URL logic to get wrong on demo day.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // fail loudly rather than silently moving port mid-demo
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
