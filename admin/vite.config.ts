import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // The shared legal module (privacy notice, terms, contact) lives at the repository
      // root in shared/legal, outside this Vite root; the dev server must be allowed to
      // serve it. Production builds bundle it normally.
      allow: ['.', '../shared'],
    },
  },
});
