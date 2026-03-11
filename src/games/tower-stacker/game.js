import { ArcadeEngine, THEME, Ease, drawGlow, drawRoundedRect, lerpColor } from '../../engine.js';

export function createGame(canvasId) {
  const W = 400, H = 700, BLOCK_H = 28, BASE_W = 200, BASE_Y = H - 80;
  const BLOCK_COLORS = [THEME.primary, THEME.accent, THEME.highlight, THEME.accentDark, '#8338EC', THEME.fail];

  let stack = [];
  let moving = null;
  let fallingPieces = [];
  let moveSpeed = 120;
  let moveDir = 1;
  let gameActive = false;
  let showInstruction = true;
  let cameraY = 0;
  let perfectStreak = 0;

  function getBlockColor(idx) { return BLOCK_COLORS[idx % BLOCK_COLORS.length]; }

  function spawnMovingBlock() {
    const prev = stack[stack.length - 1];
    const startX = moveDir > 0 ? -prev.w : W;
    moving = { x: startX, w: prev.w, y: prev.y - BLOCK_H, color: getBlockColor(stack.length), dir: moveDir };
    moveDir *= -1;
  }

  function placeBlock(engine) {
    if (!moving) return;
    const prev = stack[stack.length - 1];
    const overlapLeft = Math.max(moving.x, prev.x);
    const overlapRight = Math.min(moving.x + moving.w, prev.x + prev.w);
    const overlapW = overlapRight - overlapLeft;

    if (overlapW <= 0) {
      fallingPieces.push({ x: moving.x, y: moving.y, w: moving.w, h: BLOCK_H, vy: 0, vx: moving.dir * 30, color: moving.color, rotation: 0, rotSpeed: moving.dir * 2 });
      gameActive = false;
      engine.sound.miss(); engine.juice.shake(8); engine.juice.flash(THEME.fail, 0.2);
      moving = null;
      setTimeout(() => engine.setState('gameover'), 500);
      return;
    }

    const isPerfect = Math.abs(overlapW - prev.w) < 3;
    if (isPerfect) {
      stack.push({ x: prev.x, w: prev.w, y: moving.y, color: moving.color });
      perfectStreak++;
      engine.addScore(2);
      engine.juice.shake(3 + Math.min(perfectStreak, 8));
      const ty = stack[stack.length - 1].y - cameraY;
      engine.floatingText.spawn(200, ty, 'PERFECT!', { color: THEME.highlight, size: 24 + Math.min(perfectStreak * 2, 12), duration: 0.9 });
      engine.particles.emit(200, ty + BLOCK_H / 2, 15, { speed: [3, 7], size: [2, 5], life: [0.4, 1.0], colors: [THEME.highlight, THEME.accent, '#fff'], gravity: 60, spread: Math.PI, angle: -Math.PI / 2, type: perfectStreak > 3 ? 'star' : 'circle' });
      if (perfectStreak >= 5) engine.juice.flash(THEME.highlight, 0.1);
    } else {
      perfectStreak = 0;
      engine.resetCombo();
      stack.push({ x: overlapLeft, w: overlapW, y: moving.y, color: moving.color });
      engine.addScore(1);
      engine.juice.shake(2);
      if (moving.x < prev.x) fallingPieces.push({ x: moving.x, y: moving.y, w: prev.x - moving.x, h: BLOCK_H, vy: 0, vx: -30 - Math.random() * 20, color: moving.color, rotation: 0, rotSpeed: -1.5 - Math.random() });
      if (moving.x + moving.w > prev.x + prev.w) { const ox = prev.x + prev.w; fallingPieces.push({ x: ox, y: moving.y, w: (moving.x + moving.w) - ox, h: BLOCK_H, vy: 0, vx: 30 + Math.random() * 20, color: moving.color, rotation: 0, rotSpeed: 1.5 + Math.random() }); }
      if (overlapW < 8) {
        gameActive = false; engine.sound.miss(); engine.juice.shake(6); engine.juice.flash(THEME.fail, 0.15);
        moving = null; setTimeout(() => engine.setState('gameover'), 500); return;
      }
    }

    const blockCount = stack.length - 1;
    if (blockCount > 0 && blockCount % 10 === 0) {
      engine.juice.shake(10); engine.juice.flash(THEME.highlight, 0.12);
      const my = stack[stack.length - 1].y - cameraY;
      engine.floatingText.spawn(200, my - 40, `${blockCount} BLOCKS!`, { color: THEME.accent, size: 36, duration: 1.5 });
      engine.addScore(5);
      engine.particles.emit(200, my, 20, { speed: [3, 7], size: [3, 6], life: [0.5, 1.2], colors: THEME.particles, gravity: 40, type: 'star' });
    }

    moveSpeed = 120 + Math.min(blockCount * 4, 200);
    moving = null;
    spawnMovingBlock();
  }

  function drawBlock(ctx, block, offsetY) {
    const x = block.x, y = block.y - offsetY, w = block.w;
    if (y > H + 30 || y < -50) return;
    ctx.fillStyle = block.color; ctx.shadowColor = block.color; ctx.shadowBlur = 4;
    drawRoundedRect(ctx, x, y, w, BLOCK_H - 1, 3); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x + 2, y + 1, w - 4, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + 2, y + BLOCK_H - 4, w - 4, 2);
  }

  const game = new ArcadeEngine(canvasId, {
    name: 'TOWER STACKER', width: W, height: H,

    onStateChange(newState) {
      if (newState === 'playing') {
        stack = [{ x: (W - BASE_W) / 2, w: BASE_W, y: BASE_Y, color: getBlockColor(0) }];
        moving = null; fallingPieces = []; moveSpeed = 120; moveDir = 1;
        cameraY = 0; gameActive = true; showInstruction = true; perfectStreak = 0;
        spawnMovingBlock();
      }
    },

    onInput(type, data, engine) {
      if (type === 'tap' && gameActive && moving) { showInstruction = false; placeBlock(engine); }
    },

    onUpdate(dt, engine) {
      if (!gameActive) { fallingPieces.forEach(fp => { fp.vy += 600 * dt; fp.y += fp.vy * dt; fp.x += fp.vx * dt; fp.rotation += fp.rotSpeed * dt; }); return; }
      if (moving) { moving.x += moveSpeed * moving.dir * dt; if (moving.x + moving.w > W + 20) moving.dir = -1; else if (moving.x < -20) moving.dir = 1; }
      const targetCamY = Math.max(0, stack[stack.length - 1].y - (H * 0.6));
      cameraY += (targetCamY - cameraY) * dt * 3;
      for (let i = fallingPieces.length - 1; i >= 0; i--) { const fp = fallingPieces[i]; fp.vy += 600 * dt; fp.y += fp.vy * dt; fp.x += fp.vx * dt; fp.rotation += fp.rotSpeed * dt; if (fp.y - cameraY > H + 200) fallingPieces.splice(i, 1); }
    },

    onDraw(ctx, engine) {
      // Ground
      const gy = BASE_Y + BLOCK_H - cameraY;
      if (gy <= H) { const g = ctx.createLinearGradient(0, gy, 0, H); g.addColorStop(0, '#1a1a3e'); g.addColorStop(1, '#0d0d20'); ctx.fillStyle = g; ctx.fillRect(0, gy, W, H - gy); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(0, gy, W, 2); }
      // Stack
      for (let i = 0; i < stack.length; i++) drawBlock(ctx, stack[i], cameraY);
      // Moving
      if (moving) {
        drawBlock(ctx, moving, cameraY);
        if (stack.length > 0) { const prev = stack[stack.length - 1]; const py = prev.y - cameraY; ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(prev.x, py); ctx.lineTo(prev.x, py - 60); ctx.stroke(); ctx.beginPath(); ctx.moveTo(prev.x + prev.w, py); ctx.lineTo(prev.x + prev.w, py - 60); ctx.stroke(); ctx.setLineDash([]); }
      }
      // Falling
      fallingPieces.forEach(fp => { const y = fp.y - cameraY; if (y > H + 100) return; ctx.save(); ctx.translate(fp.x + fp.w / 2, y + fp.h / 2); ctx.rotate(fp.rotation); ctx.globalAlpha = 0.7; ctx.fillStyle = fp.color; ctx.fillRect(-fp.w / 2, -fp.h / 2, fp.w, fp.h); ctx.globalAlpha = 1; ctx.restore(); });
      // Instruction
      if (showInstruction) { const a = 0.3 + Math.sin(engine.time * 3) * 0.25; ctx.globalAlpha = a; ctx.fillStyle = THEME.textWhite; ctx.font = "600 16px Arial, sans-serif"; ctx.textAlign = 'center'; ctx.fillText('TAP TO DROP', W / 2, H * 0.45); ctx.globalAlpha = 1; }
    },
  });

  game.start();
  return game;
}
