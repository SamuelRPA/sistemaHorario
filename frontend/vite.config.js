import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Si defines VITE_API_ORIGIN, el front llama al API en ese host (no usa este proxy para /api).
// Sin VITE_API_ORIGIN: /api se proxifica a VITE_API_PROXY o http://127.0.0.1:4000 (IPv4 en Windows).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY || 'http://127.0.0.1:4000';
  const useProxy = !env.VITE_API_ORIGIN?.trim();

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: useProxy
        ? {
            '/api': {
              target: apiTarget,
              changeOrigin: true,
              secure: false,
              timeout: 120000,
              proxyTimeout: 120000,
            },
          }
        : {},
    },
  };
});
