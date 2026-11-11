import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:https` serves over HTTPS with a self-signed certificate so the
// app can be opened from a phone on the same Wi-Fi (camera + GPS need HTTPS).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'https' ? [basicSsl()] : [],
  build: {
    chunkSizeWarningLimit: 4000,
  },
}));
