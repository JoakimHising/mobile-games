import { THEME } from '../engine.js';

// Game registry — add new games here
const GAMES = [
  { id: 'bin-it', name: 'BIN IT!', desc: 'Throw paper into bins', color: THEME.primary, icon: '🗑️', loader: () => import('../games/bin-it/game.js') },
  { id: 'juggle-king', name: 'JUGGLE KING', desc: 'Keep the ball in the air', color: THEME.accent, icon: '⚽', loader: () => import('../games/juggle-king/game.js') },
  { id: 'goalie', name: 'GOALIE', desc: 'Dive to save shots on goal', color: THEME.highlight, icon: '🧤', loader: () => import('../games/goalie/game.js') },
  { id: 'roof-hopper', name: 'ROOF HOPPER', desc: 'Jump across rooftops', color: THEME.accentDark, icon: '🏃', loader: () => import('../games/roof-hopper/game.js') },
  { id: 'dart-streak', name: 'DART STREAK', desc: 'Flick darts at the board', color: THEME.fail, icon: '🎯', loader: () => import('../games/dart-streak/game.js') },
  { id: 'tower-stacker', name: 'TOWER STACKER', desc: 'Stack blocks sky high', color: '#8338EC', icon: '🏗️', loader: () => import('../games/tower-stacker/game.js') },
  { id: 'perfect-serve', name: 'PERFECT SERVE', desc: 'Serve aces on the court', color: '#1a6a2a', icon: '🎾', loader: () => import('../games/perfect-serve/game.js') },
  { id: 'hole-in-one', name: 'HOLE IN ONE', desc: 'Sink putts in one shot', color: '#1a6a2a', icon: '⛳', loader: () => import('../games/hole-in-one/game.js') },
  { id: 'skee-ball', name: 'SKEE-BALL', desc: 'Roll for the high score', color: THEME.primaryDark, icon: '🎳', loader: () => import('../games/skee-ball/game.js') },
  { id: 'punch-out', name: 'PUNCH OUT', desc: 'Dodge incoming punches', color: THEME.fail, icon: '🥊', loader: () => import('../games/punch-out/game.js') },
  { id: 'pint-pour', name: 'PINT POUR', desc: 'Pour the perfect pint', color: '#ddaa22', icon: '🍺', loader: () => import('../games/pint-pour/game.js') },
];

function getBest(gameId) {
  const key = 'arcade_best_' + gameId.replace(/-/g, '_').replace(/!/g, '');
  return parseInt(localStorage.getItem(key) || '0');
}

export function createMenu(canvasId) {
  const canvas = document.getElementById(canvasId);
  const menuScreen = document.getElementById('menu-screen');
  const cardList = document.getElementById('card-list');
  const gameCount = document.getElementById('game-count');
  const backBtn = document.getElementById('back-btn');

  let currentGame = null;
  let resizeHandler = null;

  gameCount.textContent = `${GAMES.length} games available`;

  // Map of game index → best score span
  const bestSpans = [];

  function buildCard(game, index) {
    const btn = document.createElement('button');
    btn.className = 'game-card';
    btn.style.setProperty('--card-color', game.color);
    btn.style.animationDelay = `${index * 0.06}s`;

    const best = getBest(game.id);
    const bestHTML = best > 0 ? `<div class="card-best">BEST: ${best}</div>` : '';

    btn.innerHTML = `
      <div class="card-icon"><span>${game.icon}</span></div>
      <div class="card-info">
        <div class="card-name">${game.name}</div>
        <div class="card-desc">${game.desc}</div>
        ${bestHTML}
      </div>
      <div class="card-arrow">&#9654;</div>
    `;

    bestSpans[index] = null; // will be resolved lazily

    btn.addEventListener('click', () => launchGame(index));
    return btn;
  }

  // Build all cards
  GAMES.forEach((game, i) => {
    cardList.appendChild(buildCard(game, i));
  });

  // Canvas resize helper
  function resizeCanvas() {
    const W = 400, H = 700;
    const isNative = typeof window.Capacitor !== 'undefined';
    const maxScale = isNative ? Infinity : 1;
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H, maxScale);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W * scale + 'px';
    canvas.style.height = H * scale + 'px';
  }

  async function launchGame(index) {
    if (currentGame) return;
    const gameInfo = GAMES[index];

    try {
      const mod = await gameInfo.loader();

      // Switch views
      menuScreen.style.display = 'none';
      canvas.style.display = 'block';

      // Set up canvas sizing
      resizeCanvas();
      resizeHandler = resizeCanvas;
      window.addEventListener('resize', resizeHandler);

      // Center canvas
      document.body.style.display = 'flex';
      document.body.style.justifyContent = 'center';
      document.body.style.alignItems = 'center';

      currentGame = mod.createGame(canvasId);

      // Show back button
      backBtn.style.display = 'flex';
    } catch (err) {
      console.error('Failed to load game:', err);
    }
  }

  function returnToMenu() {
    if (currentGame) {
      currentGame.destroy();
      currentGame = null;
    }

    // Clean up resize listener
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }

    // Hide back button
    backBtn.style.display = 'none';

    // Switch views
    canvas.style.display = 'none';
    menuScreen.style.display = 'flex';

    // Reset body styles
    document.body.style.display = '';
    document.body.style.justifyContent = '';
    document.body.style.alignItems = '';

    // Refresh scores
    refreshScores();

    // Re-trigger entrance animations
    const cards = cardList.querySelectorAll('.game-card');
    cards.forEach((card, i) => {
      card.style.animation = 'none';
      card.offsetHeight; // force reflow
      card.style.animation = '';
      card.style.animationDelay = `${i * 0.06}s`;
    });

    // Scroll to top
    cardList.scrollTop = 0;
  }

  function refreshScores() {
    const cards = cardList.querySelectorAll('.game-card');
    cards.forEach((card, i) => {
      const game = GAMES[i];
      const best = getBest(game.id);
      let bestEl = card.querySelector('.card-best');

      if (best > 0) {
        if (!bestEl) {
          bestEl = document.createElement('div');
          bestEl.className = 'card-best';
          card.querySelector('.card-info').appendChild(bestEl);
        }
        bestEl.textContent = `BEST: ${best}`;
      } else if (bestEl) {
        bestEl.remove();
      }
    });
  }

  // Back button overlay click
  backBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    returnToMenu();
  });

  // Expose for back button handling (capacitor-bridge.js)
  window._arcadeReturnToMenu = returnToMenu;

  return { returnToMenu, launchGame };
}
