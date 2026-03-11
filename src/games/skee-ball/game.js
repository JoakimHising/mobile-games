import { ArcadeEngine, THEME, Ease, drawGlow, drawRoundedRect, lerpColor } from '../../engine.js';

export function createGame(canvasId) {
  const W = 400, H = 700;

  let ball = null;
  let ramp = { x: W / 2, bottom: H - 80, top: 180, width: 260 };
  let scoreHoles = [];
  let gameActive = false;
  let showInstruction = true;
  let rollsCompleted = 0;
  let ballReady = true;

  const HOLE_POINTS = [10, 20, 30, 50, 30, 20, 10];
  const HOLE_COLORS = [THEME.textDim, THEME.accentDark, THEME.accent, THEME.highlight, THEME.accent, THEME.accentDark, THEME.textDim];

  function setupHoles() {
    scoreHoles = [];
    const count = HOLE_POINTS.length;
    const totalW = ramp.width - 20;
    const holeW = totalW / count;
    const shrink = Math.max(0.5, 1 - rollsCompleted * 0.015);

    for (let i = 0; i < count; i++) {
      const cx = (W - totalW) / 2 + i * holeW + holeW / 2;
      scoreHoles.push({
        x: cx,
        y: ramp.top + 20,
        w: holeW * shrink * 0.85,
        h: 24,
        points: HOLE_POINTS[i],
        color: HOLE_COLORS[i],
      });
    }
  }

  function resetBall() {
    ball = { x: W / 2, y: ramp.bottom - 20, vx: 0, vy: 0, radius: 12, rolling: false, airborne: false };
    ballReady = true;
  }

  function rollBall(dx, dy, power, engine) {
    if (!ballReady) return;
    ballReady = false;
    showInstruction = false;

    // Upward flick sends ball up the ramp
    const speed = 250 + power * 350;
    ball.vx = dx * 0.8;
    ball.vy = -speed;
    ball.rolling = true;
    engine.sound.throw();
    engine.juice.shake(2);
  }

  function checkScore(engine) {
    if (!ball || !ball.airborne) return false;

    for (const hole of scoreHoles) {
      if (ball.x > hole.x - hole.w / 2 && ball.x < hole.x + hole.w / 2 &&
          ball.y > hole.y - hole.h / 2 && ball.y < hole.y + hole.h / 2) {
        // Scored!
        const pts = hole.points;
        engine.addScore(pts);
        rollsCompleted++;

        if (pts >= 50) {
          engine.juice.shake(12);
          engine.juice.slowMo(0.2, 0.3);
          engine.juice.flash(THEME.highlight, 0.15);
          engine.floatingText.spawn(hole.x, hole.y - 30, `+${pts}`, { color: THEME.highlight, size: 36, duration: 1.2 });
          engine.particles.emit(hole.x, hole.y, 25, { speed: [4, 9], size: [3, 6], life: [0.5, 1.2], colors: [THEME.highlight, '#fff', THEME.primary], gravity: 50, type: 'star' });
        } else if (pts >= 30) {
          engine.juice.shake(6);
          engine.floatingText.spawn(hole.x, hole.y - 25, `+${pts}`, { color: THEME.accent, size: 28, duration: 1.0 });
          engine.particles.emit(hole.x, hole.y, 15, { speed: [3, 7], size: [2, 5], life: [0.4, 0.9], colors: [THEME.accent, THEME.accentLight], gravity: 40 });
        } else if (pts >= 20) {
          engine.juice.shake(3);
          engine.floatingText.spawn(hole.x, hole.y - 20, `+${pts}`, { color: THEME.primary, size: 22, duration: 0.8 });
          engine.particles.emit(hole.x, hole.y, 8, { speed: [2, 5], size: [2, 4], life: [0.3, 0.7], colors: [THEME.primary, THEME.primaryLight], gravity: 30 });
        } else {
          engine.floatingText.spawn(hole.x, hole.y - 15, `+${pts}`, { color: THEME.textWhite, size: 18, duration: 0.6 });
          engine.particles.emit(hole.x, hole.y, 5, { speed: [1, 3], size: [2, 3], life: [0.2, 0.5], colors: ['#fff'], gravity: 20 });
        }

        // Milestone
        if (rollsCompleted > 0 && rollsCompleted % 5 === 0) {
          engine.juice.flash(THEME.highlight, 0.08);
          engine.floatingText.spawn(200, 400, `${rollsCompleted} ROLLS!`, { color: THEME.accent, size: 32, duration: 1.5 });
          engine.addScore(10);
        }

        setupHoles(); // holes shrink
        resetBall();
        return true;
      }
    }
    return false;
  }

  function drawRamp(ctx, engine) {
    // Ramp body
    const grad = ctx.createLinearGradient(0, ramp.top, 0, ramp.bottom);
    grad.addColorStop(0, '#2a1a0a');
    grad.addColorStop(0.3, '#3a2a1a');
    grad.addColorStop(1, '#4a3a2a');
    ctx.fillStyle = grad;

    const lx = W / 2 - ramp.width / 2;
    const rx = W / 2 + ramp.width / 2;
    ctx.beginPath();
    ctx.moveTo(lx + 20, ramp.top);
    ctx.lineTo(rx - 20, ramp.top);
    ctx.lineTo(rx, ramp.bottom);
    ctx.lineTo(lx, ramp.bottom);
    ctx.closePath();
    ctx.fill();

    // Rails
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lx + 20, ramp.top);
    ctx.lineTo(lx, ramp.bottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rx - 20, ramp.top);
    ctx.lineTo(rx, ramp.bottom);
    ctx.stroke();

    // Lane dividers
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const frac = i / 4;
      const topX = lx + 20 + (rx - lx - 40) * frac;
      const botX = lx + (rx - lx) * frac;
      ctx.beginPath();
      ctx.moveTo(topX, ramp.top + 60);
      ctx.lineTo(botX, ramp.bottom - 10);
      ctx.stroke();
    }

    // Bump at top
    ctx.fillStyle = '#5a4a3a';
    const bumpY = ramp.top + 60;
    ctx.beginPath();
    ctx.arc(W / 2, bumpY, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHoles(ctx, engine) {
    scoreHoles.forEach(hole => {
      // Hole background
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      drawRoundedRect(ctx, hole.x - hole.w / 2, hole.y - hole.h / 2, hole.w, hole.h, 6);
      ctx.fill();

      // Border glow
      ctx.strokeStyle = hole.color;
      ctx.shadowColor = hole.color;
      ctx.shadowBlur = hole.points >= 50 ? 12 : 6;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Points label
      ctx.fillStyle = hole.color;
      ctx.font = `bold ${hole.points >= 50 ? 14 : 11}px 'Arial Black', Impact, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(hole.points, hole.x, hole.y + 4);
    });
  }

  function drawBall(ctx) {
    if (!ball) return;
    // Shadow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(ball.x + 2, ball.y + 3, ball.radius, ball.radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Ball
    const grad = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 0, ball.x, ball.y, ball.radius);
    grad.addColorStop(0, '#ff8855');
    grad.addColorStop(1, '#cc4400');
    ctx.fillStyle = grad;
    ctx.shadowColor = THEME.primary;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(ball.x - 3, ball.y - 3, ball.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawInstruction(ctx, engine) {
    if (!showInstruction || !ballReady) return;
    const alpha = 0.3 + Math.sin(engine.time * 3) * 0.25;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = THEME.textWhite;
    ctx.font = "600 16px Arial, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('FLICK UP TO ROLL', W / 2, H - 30);
    ctx.globalAlpha = 1;
  }

  const game = new ArcadeEngine(canvasId, {
    name: 'SKEE-BALL', width: W, height: H,

    onStateChange(newState) {
      if (newState === 'playing') {
        rollsCompleted = 0;
        gameActive = true;
        showInstruction = true;
        setupHoles();
        resetBall();
      }
    },

    onInput(type, data, engine) {
      if (!gameActive) return;
      if (type === 'drag_end' && ballReady && data.dy < -20 && data.distance > 30) {
        rollBall(data.dx, data.dy, data.power, engine);
      }
    },

    onUpdate(dt, engine) {
      if (!gameActive) return;

      if (ball && ball.rolling) {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.vx *= 0.99;

        // Ramp: ball decelerates as it goes up
        ball.vy += 100 * dt; // gravity pulling back

        // Ramp boundaries — narrow toward top
        const progress = 1 - (ball.y - ramp.top) / (ramp.bottom - ramp.top);
        const halfW = (ramp.width / 2) - progress * 20;
        const leftEdge = W / 2 - halfW;
        const rightEdge = W / 2 + halfW;

        if (ball.x - ball.radius < leftEdge) { ball.x = leftEdge + ball.radius; ball.vx = Math.abs(ball.vx) * 0.5; }
        if (ball.x + ball.radius > rightEdge) { ball.x = rightEdge - ball.radius; ball.vx = -Math.abs(ball.vx) * 0.5; }

        // Ball reaches scoring zone
        if (ball.y < ramp.top + 50 && !ball.airborne) {
          ball.airborne = true;
        }

        if (ball.airborne) {
          if (checkScore(engine)) return;
        }

        // Ball rolled back to bottom or off screen
        if (ball.y > ramp.bottom + 30) {
          // Gutter — game over
          gameActive = false;
          engine.sound.miss();
          engine.juice.shake(5);
          engine.juice.flash(THEME.fail, 0.15);
          setTimeout(() => engine.setState('gameover'), 400);
        }

        // Ball went past top without scoring
        if (ball.y < ramp.top - 30) {
          gameActive = false;
          engine.sound.miss();
          engine.juice.shake(4);
          engine.juice.flash(THEME.fail, 0.12);
          setTimeout(() => engine.setState('gameover'), 400);
        }
      }
    },

    onDraw(ctx, engine) {
      drawRamp(ctx, engine);
      drawHoles(ctx, engine);
      drawBall(ctx);
      drawInstruction(ctx, engine);
    },
  });

  game.start();
  return game;
}
