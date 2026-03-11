import { defineConfig } from 'vite';
import { resolve } from 'path';

const mode = process.env.BUILD_MODE || 'arcade';

const entryPoints = {
  arcade: resolve(__dirname, 'src/arcade/index.html'),
  'bin-it': resolve(__dirname, 'src/standalone/bin-it.html'),
  'juggle-king': resolve(__dirname, 'src/standalone/juggle-king.html'),
  'goalie': resolve(__dirname, 'src/standalone/goalie.html'),
  'roof-hopper': resolve(__dirname, 'src/standalone/roof-hopper.html'),
};

export default defineConfig({
  root: '.',
  build: {
    outDir: `dist/${mode}`,
    emptyOutDir: true,
    rollupOptions: {
      input: entryPoints[mode],
    },
  },
  server: {
    // Dev server serves from src/arcade by default
    open: '/src/arcade/index.html',
  },
});
