import { THEME, Ease, drawGlow, drawRoundedRect, lerpColor } from '../engine.js';

// Game registry — add new games here
const GAMES = [
  { id: 'bin-it', name: 'BIN IT!', desc: 'Throw paper into bins', color: THEME.primary, icon: '🗑️', loader: () => import('../games/bin-it/game.js') },
  { id: 'juggle-king', name: 'JUGGLE KING', desc: 'Keep the ball in the air', color: THEME.accent, icon: '⚽', loader: () => import('../games/juggle-king/game.js') },
  { id: 'goalie', name: 'GOALIE', desc: 'Dive to save shots on goal', color: THEME.highlight, icon: '🧤', loader: () => import('../games/goalie/game.js') },
  { id: 'roof-hopper', name: 'ROOF HOPPER', desc: 'Jump across rooftops', color: THEME.accentDark, icon: '🏃', loader: () => import('../games/roof-hopper/game.js') },
  { id: 'dart-streak', name: 'DART STREAK', desc: 'Flick darts at the board', color: THEME.fail, icon: '🎯', loader: () => import('../games/dart-streak/game.js') },
  { id: 'tower-stacker', name: 'TOWER STACKER', desc: 'Stack blocks sky high', color: '#8338EC', icon: '🏗️', loader: () => import('../games/tower-stacker/game.js') },
];

export function createMenu(canvasId) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const W = 400, H = 700;
  canvas.width = W;
  canvas.height = H;

  // Responsive sizing
  const isNative = typeof window.Capacitor !== 'undefined';
  function resize() {
    const maxScale = isNative ? Infinity : 1;
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H, maxScale);
    canvas.style.width = W * scale + 'px';
    canvas.style.height = H * scale + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  // State
  let time = 0;
  let running = true;
  let currentGame = null;
  let selectedIndex = -1;
  let hoverIndex = -1;
  let scrollY = 0;

  // Background stars
  const stars = [];
  for (let i = 0; i < 50; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.3 + 0.1,
    });
  }

  // Card layout
  const CARD_TOP = 180;
  const CARD_HEIGHT = 100;
  const CARD_GAP = 18;
  const CARD_MARGIN = 30;
  const CARD_WIDTH = W - CARD_MARGIN * 2;

  function getCardY(index) {
    return CARD_TOP + index * (CARD_HEIGHT + CARD_GAP);
  }

  // Get best score for a game
  function getBest(gameId) {
    const key = 'arcade_best_' + gameId.replace(/-/g, '_').replace(/!/g, '');
    return parseInt(localStorage.getItem(key) || '0');
  }

  // Input handling
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    };
  }

  function onTap(e) {
    if (currentGame) return;
    if (e.touches) e.preventDefault();
    const pos = getPos(e);

    // Check back button area when in game
    // Check card hits
    for (let i = 0; i < GAMES.length; i++) {
      const cy = getCardY(i);
      if (pos.x > CARD_MARGIN && pos.x < CARD_MARGIN + CARD_WIDTH &&
          pos.y > cy && pos.y < cy + CARD_HEIGHT) {
        launchGame(i);
        return;
      }
    }
  }

  canvas.addEventListener('touchstart', onTap, { passive: false });
  canvas.addEventListener('mousedown', onTap);

  // Launch a game
  async function launchGame(index) {
    if (currentGame) return;
    selectedIndex = index;
    const gameInfo = GAMES[index];

    try {
      const mod = await gameInfo.loader();
      running = false; // pause menu loop
      currentGame = mod.createGame(canvasId);

      // Store reference to return to menu
      const origOnStateChange = currentGame.config.onStateChange;
      // We don't override state change — the game handles it
    } catch (err) {
      console.error('Failed to load game:', err);
      selectedIndex = -1;
    }
  }

  // Return to menu (called externally or via back button)
  function returnToMenu() {
    if (currentGame) {
      currentGame.destroy();
      currentGame = null;
    }
    selectedIndex = -1;
    canvas.width = W;
    canvas.height = H;
    resize();
    running = true;
    requestAnimationFrame(loop);
  }

  // Expose for back button handling
  window._arcadeReturnToMenu = returnToMenu;

  // Drawing
  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, THEME.bgGrad1);
    grad.addColorStop(1, THEME.bgGrad2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    stars.forEach(s => {
      ctx.globalAlpha = 0.2 + Math.sin(time * s.speed * 5 + s.x) * 0.3;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawTitle() {
    const scale = 1 + Math.sin(time * 2) * 0.02;
    ctx.save();
    ctx.translate(W / 2, 70);
    ctx.scale(scale, scale);
    ctx.fillStyle = THEME.textWhite;
    ctx.shadowColor = THEME.primary;
    ctx.shadowBlur = 25;
    ctx.font = "bold 40px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('ARCADE', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.fillStyle = THEME.textDim;
    ctx.font = "600 14px Arial, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('Choose a game', W / 2, 110);
  }

  function drawCard(index) {
    const gameInfo = GAMES[index];
    const y = getCardY(index);
    const best = getBest(gameInfo.id);

    // Card entrance animation
    const entryDelay = index * 0.15;
    const entryT = Math.min(1, Math.max(0, (time - entryDelay) * 2));
    const entryEase = Ease.outBack(entryT);
    const cardAlpha = entryT;
    const cardOffsetX = (1 - entryEase) * 100;

    ctx.globalAlpha = cardAlpha;
    ctx.save();
    ctx.translate(cardOffsetX, 0);

    // Card background
    const cardGrad = ctx.createLinearGradient(CARD_MARGIN, y, CARD_MARGIN + CARD_WIDTH, y);
    cardGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
    cardGrad.addColorStop(1, 'rgba(255,255,255,0.03)');
    ctx.fillStyle = cardGrad;
    drawRoundedRect(ctx, CARD_MARGIN, y, CARD_WIDTH, CARD_HEIGHT, 16);
    ctx.fill();

    // Card border
    ctx.strokeStyle = gameInfo.color + '40';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, CARD_MARGIN, y, CARD_WIDTH, CARD_HEIGHT, 16);
    ctx.stroke();

    // Left color accent bar
    ctx.fillStyle = gameInfo.color;
    ctx.shadowColor = gameInfo.color;
    ctx.shadowBlur = 10;
    drawRoundedRect(ctx, CARD_MARGIN, y, 5, CARD_HEIGHT, 3);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Icon
    ctx.font = '36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(gameInfo.icon, CARD_MARGIN + 45, y + 58);

    // Game name
    ctx.fillStyle = THEME.textWhite;
    ctx.font = "bold 22px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = 'left';
    ctx.fillText(gameInfo.name, CARD_MARGIN + 80, y + 40);

    // Description
    ctx.fillStyle = THEME.textDim;
    ctx.font = "400 13px Arial, sans-serif";
    ctx.fillText(gameInfo.desc, CARD_MARGIN + 80, y + 62);

    // Best score
    if (best > 0) {
      ctx.fillStyle = THEME.highlight;
      ctx.font = "bold 14px 'Arial Black', Impact, sans-serif";
      ctx.textAlign = 'right';
      ctx.fillText(`BEST: ${best}`, CARD_MARGIN + CARD_WIDTH - 20, y + 40);
    }

    // Play arrow
    ctx.fillStyle = gameInfo.color;
    ctx.beginPath();
    const arrowX = CARD_MARGIN + CARD_WIDTH - 30;
    const arrowY = y + CARD_HEIGHT / 2 + 10;
    ctx.moveTo(arrowX, arrowY - 8);
    ctx.lineTo(arrowX + 12, arrowY);
    ctx.lineTo(arrowX, arrowY + 8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawFooter() {
    ctx.fillStyle = THEME.textDim;
    ctx.font = "400 11px Arial, sans-serif";
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.4;
    ctx.fillText(`${GAMES.length} games available`, W / 2, H - 30);
    ctx.globalAlpha = 1;
  }

  // Main loop
  function loop(timestamp) {
    if (!running) return;

    const dt = Math.min((timestamp - (loop._last || timestamp)) / 1000, 0.05);
    loop._last = timestamp;
    time += dt;

    drawBackground();
    drawTitle();

    for (let i = 0; i < GAMES.length; i++) {
      drawCard(i);
    }

    drawFooter();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  return { returnToMenu, launchGame };
}
