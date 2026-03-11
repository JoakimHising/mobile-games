import { defineConfig } from 'vite';
import { resolve } from 'path';

const mode = process.env.BUILD_MODE || 'arcade';

const entryPoints = {
  arcade: resolve(__dirname, 'src/arcade/index.html'),
  'bin-it': resolve(__dirname, 'src/standalone/bin-it.html'),
  'juggle-king': resolve(__dirname, 'src/standalone/juggle-king.html'),
  'goalie': resolve(__dirname, 'src/standalone/goalie.html'),
  'roof-hopper': resolve(__dirname, 'src/standalone/roof-hopper.html'),
  'dart-streak': resolve(__dirname, 'src/standalone/dart-streak.html'),
  'tower-stacker': resolve(__dirname, 'src/standalone/tower-stacker.html'),
  'perfect-serve': resolve(__dirname, 'src/standalone/perfect-serve.html'),
  'hole-in-one': resolve(__dirname, 'src/standalone/hole-in-one.html'),
  'skee-ball': resolve(__dirname, 'src/standalone/skee-ball.html'),
  'punch-out': resolve(__dirname, 'src/standalone/punch-out.html'),
  'pint-pour': resolve(__dirname, 'src/standalone/pint-pour.html'),
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
