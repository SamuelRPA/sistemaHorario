import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Usa 127.0.0.1 para evitar ECONNREFUSED por IPv6 en Windows. VITE_API_PROXY=http://127.0.0.1:PUERTO si tu API no usa 4000.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY || 'http://127.0.0.1:4000';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          timeout: 120000,
          proxyTimeout: 120000,
        },
      },
    },
  };
});
