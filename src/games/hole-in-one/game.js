import { ArcadeEngine, THEME, Ease, drawGlow, drawRoundedRect, lerpColor } from '../../engine.js';

export function createGame(canvasId) {
  const W = 400, H = 700;

  let ball = null;
  let hole = null;
  let obstacles = [];
  let holesCleared = 0;
  let gameActive = false;
  let showInstruction = true;
  let aimAngle = 0;
  let aimPower = 0;
  let aimPhase = 'angle'; // 'angle' -> 'power' -> 'flying'
  let oscillator = 0;

  const GREEN_COLOR = '#1a6a2a';
  const FAIRWAY = '#1a5a22';
  const SAND_COLOR = '#c2a84d';

  function spawnHole() {
    const difficulty = Math.min(holesCleared, 30);

    hole = {
      x: 80 + Math.random() * (W - 160),
      y: 100 + Math.random() * 120,
      radius: Math.max(14, 28 - difficulty * 0.4),
      flagWave: 0,
    };

    // Ball starting position
    ball = {
      x: W / 2,
      y: H - 150,
      vx: 0, vy: 0,
      radius: 8,
      rolling: false,
    };

    // Obstacles after hole 3
    obstacles = [];
    if (holesCleared >= 3) {
      const numObs = Math.min(Math.floor((holesCleared - 2) / 2), 4);
      for (let i = 0; i < numObs; i++) {
        const type = Math.random() < 0.5 ? 'sand' : 'water';
        obstacles.push({
          x: 60 + Math.random() * (W - 120),
          y: 200 + Math.random() * (H - 400),
          w: 40 + Math.random() * 50,
          h: 25 + Math.random() * 30,
          type,
        });
      }
    }

    aimPhase = 'angle';
    oscillator = 0;
  }

  function shootBall(engine) {
    const rad = (aimAngle - 90) * Math.PI / 180;
    const speed = 300 + aimPower * 400;
    ball.vx = Math.cos(rad) * speed;
    ball.vy = Math.sin(rad) * speed;
    ball.rolling = true;
    aimPhase = 'flying';
    engine.sound.throw();
    engine.juice.shake(2);
  }

  function checkHoleIn(engine) {
    if (!ball || !hole || !ball.rolling) return false;
    const dx = ball.x - hole.x;
    const dy = ball.y - hole.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

    if (dist < hole.radius + ball.radius * 0.5 && speed < 300) {
      // Sunk it!
      holesCleared++;
      engine.addScore(1);

      // Bonus for precision
      if (dist < hole.radius * 0.3) {
        engine.addScore(2);
        engine.juice.shake(10);
        engine.juice.slowMo(0.2, 0.3);
        engine.floatingText.spawn(hole.x, hole.y - 30, 'HOLE IN ONE!', { color: THEME.highlight, size: 30, duration: 1.2 });
        engine.particles.emit(hole.x, hole.y, 25, { speed: [4, 9], size: [3, 6], life: [0.5, 1.2], colors: [THEME.highlight, THEME.primary, '#fff'], gravity: 50, type: 'star' });
      } else {
        engine.juice.shake(5);
        engine.floatingText.spawn(hole.x, hole.y - 20, 'IN!', { color: THEME.accent, size: 24, duration: 0.8 });
        engine.particles.emit(hole.x, hole.y, 12, { speed: [2, 6], size: [2, 4], life: [0.3, 0.8], colors: [THEME.accent, THEME.accentLight], gravity: 40 });
      }

      // Milestone
      if (holesCleared > 0 && holesCleared % 5 === 0) {
        engine.juice.flash(THEME.highlight, 0.1);
        engine.floatingText.spawn(200, 350, `${holesCleared} HOLES!`, { color: THEME.accent, size: 36, duration: 1.5 });
        engine.addScore(5);
      }

      // Next hole
      setTimeout(() => { if (gameActive) spawnHole(); }, 600);
      ball.rolling = false;
      return true;
    }
    return false;
  }

  function drawGreen(ctx) {
    // Fairway
    ctx.fillStyle = FAIRWAY;
    ctx.fillRect(20, 20, W - 40, H - 80);

    // Rough border
    ctx.strokeStyle = '#0d4a14';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, W - 40, H - 80);

    // Green (around hole)
    if (hole) {
      const gr = ctx.createRadialGradient(hole.x, hole.y, 0, hole.x, hole.y, 80);
      gr.addColorStop(0, GREEN_COLOR);
      gr.addColorStop(1, FAIRWAY);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, 80, 0, Math.PI * 2);
      ctx.fill();
    }

    // Obstacles
    obstacles.forEach(o => {
      if (o.type === 'sand') {
        ctx.fillStyle = SAND_COLOR;
        drawRoundedRect(ctx, o.x - o.w / 2, o.y - o.h / 2, o.w, o.h, 6);
        ctx.fill();
        ctx.strokeStyle = '#a08830';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#2266cc';
        drawRoundedRect(ctx, o.x - o.w / 2, o.y - o.h / 2, o.w, o.h, 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(o.x - o.w / 2 + 4, o.y - o.h / 2 + 3, o.w - 8, 4);
      }
    });
  }

  function drawHole(ctx, engine) {
    if (!hole) return;
    // Hole
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Flag
    const flagX = hole.x + hole.radius * 0.3;
    const flagBaseY = hole.y;
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(flagX, flagBaseY);
    ctx.lineTo(flagX, flagBaseY - 40);
    ctx.stroke();

    // Flag cloth
    hole.flagWave = engine.time;
    ctx.fillStyle = THEME.fail;
    ctx.beginPath();
    ctx.moveTo(flagX, flagBaseY - 40);
    ctx.lineTo(flagX + 18 + Math.sin(hole.flagWave * 4) * 3, flagBaseY - 33);
    ctx.lineTo(flagX, flagBaseY - 26);
    ctx.closePath();
    ctx.fill();

    // Hole number
    ctx.fillStyle = THEME.textDim;
    ctx.font = "bold 12px Arial, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(`HOLE ${holesCleared + 1}`, hole.x, hole.y + hole.radius + 18);
  }

  function drawBall(ctx) {
    if (!ball) return;
    // Shadow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(ball.x + 2, ball.y + 2, ball.radius, ball.radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Ball
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Dimple hint
    ctx.strokeStyle = 'rgba(200,200,200,0.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(ball.x - 2, ball.y - 2, ball.radius * 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawAimGuide(ctx, engine) {
    if (!ball || aimPhase === 'flying') return;

    if (aimPhase === 'angle') {
      // Oscillating angle indicator
      const a = oscillator;
      const rad = (a - 90) * Math.PI / 180;
      const len = 80;
      ctx.strokeStyle = THEME.primary;
      ctx.lineWidth = 3;
      ctx.shadowColor = THEME.primary;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x + Math.cos(rad) * len, ball.y + Math.sin(rad) * len);
      ctx.stroke();

      // Arrow head
      const ax = ball.x + Math.cos(rad) * len;
      const ay = ball.y + Math.sin(rad) * len;
      ctx.fillStyle = THEME.primary;
      ctx.beginPath();
      ctx.arc(ax, ay, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Hint
      const alpha = 0.3 + Math.sin(engine.time * 3) * 0.2;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = THEME.textWhite;
      ctx.font = "600 14px Arial, sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('TAP TO SET ANGLE', W / 2, H - 50);
      ctx.globalAlpha = 1;
    } else if (aimPhase === 'power') {
      // Show locked angle + power bar
      const rad = (aimAngle - 90) * Math.PI / 180;
      const len = 40 + oscillator * 60;
      ctx.strokeStyle = THEME.accent;
      ctx.lineWidth = 3;
      ctx.shadowColor = THEME.accent;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x + Math.cos(rad) * len, ball.y + Math.sin(rad) * len);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Power bar
      const barX = W - 40, barY = H - 280, barW = 20, barH = 200;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      drawRoundedRect(ctx, barX, barY, barW, barH, 5);
      ctx.fill();

      const fillH = barH * oscillator;
      const barColor = lerpColor('#00F5D4', '#FF006E', oscillator);
      ctx.fillStyle = barColor;
      ctx.shadowColor = barColor;
      ctx.shadowBlur = 8;
      drawRoundedRect(ctx, barX, barY + barH - fillH, barW, fillH, 5);
      ctx.fill();
      ctx.shadowBlur = 0;

      const alpha = 0.3 + Math.sin(engine.time * 3) * 0.2;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = THEME.textWhite;
      ctx.font = "600 14px Arial, sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('TAP TO SET POWER', W / 2, H - 50);
      ctx.globalAlpha = 1;
    }
  }

  const game = new ArcadeEngine(canvasId, {
    name: 'HOLE IN ONE', width: W, height: H,

    onStateChange(newState) {
      if (newState === 'playing') {
        holesCleared = 0;
        gameActive = true;
        showInstruction = true;
        spawnHole();
      }
    },

    onInput(type, data, engine) {
      if (!gameActive) return;
      if (type === 'tap') {
        showInstruction = false;
        if (aimPhase === 'angle') {
          aimAngle = oscillator;
          aimPhase = 'power';
          oscillator = 0;
          engine.sound.tap();
        } else if (aimPhase === 'power') {
          aimPower = oscillator;
          shootBall(engine);
        }
      }
    },

    onUpdate(dt, engine) {
      if (!gameActive) return;

      // Oscillators for aim
      if (aimPhase === 'angle') {
        // Swing angle from -60 to 60 degrees (relative to up)
        oscillator = Math.sin(engine.time * 2.5) * 60;
      } else if (aimPhase === 'power') {
        // Power oscillates 0 to 1
        oscillator = (Math.sin(engine.time * 3) + 1) / 2;
      }

      // Ball physics
      if (ball && ball.rolling) {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        // Friction
        ball.vx *= 0.985;
        ball.vy *= 0.985;

        // Sand trap slows more
        obstacles.forEach(o => {
          if (o.type === 'sand') {
            if (ball.x > o.x - o.w / 2 && ball.x < o.x + o.w / 2 &&
                ball.y > o.y - o.h / 2 && ball.y < o.y + o.h / 2) {
              ball.vx *= 0.95;
              ball.vy *= 0.95;
            }
          }
          // Water trap = game over
          if (o.type === 'water') {
            if (ball.x > o.x - o.w / 2 && ball.x < o.x + o.w / 2 &&
                ball.y > o.y - o.h / 2 && ball.y < o.y + o.h / 2) {
              gameActive = false;
              engine.sound.miss();
              engine.juice.shake(6);
              engine.juice.flash('#2266cc', 0.2);
              engine.floatingText.spawn(ball.x, ball.y - 20, 'SPLASH!', { color: '#2266cc', size: 28, duration: 1.0 });
              engine.particles.emit(ball.x, ball.y, 15, { speed: [2, 6], size: [2, 5], life: [0.3, 0.8], colors: ['#2266cc', '#4488ee', '#fff'], gravity: 80 });
              ball.rolling = false;
              setTimeout(() => engine.setState('gameover'), 500);
            }
          }
        });

        // Wall bounces
        if (ball.x < 28) { ball.x = 28; ball.vx = Math.abs(ball.vx) * 0.6; }
        if (ball.x > W - 28) { ball.x = W - 28; ball.vx = -Math.abs(ball.vx) * 0.6; }
        if (ball.y < 28) { ball.y = 28; ball.vy = Math.abs(ball.vy) * 0.6; }
        if (ball.y > H - 68) { ball.y = H - 68; ball.vy = -Math.abs(ball.vy) * 0.6; }

        checkHoleIn(engine);

        // Ball stopped without sinking
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (speed < 5 && ball.rolling) {
          ball.rolling = false;
          // Missed the hole — game over
          gameActive = false;
          engine.sound.miss();
          engine.juice.shake(4);
          engine.juice.flash(THEME.fail, 0.15);
          engine.floatingText.spawn(ball.x, ball.y - 20, 'MISS!', { color: THEME.fail, size: 24, duration: 0.8 });
          setTimeout(() => engine.setState('gameover'), 500);
        }
      }
    },

    onDraw(ctx, engine) {
      drawGreen(ctx);
      drawHole(ctx, engine);
      drawBall(ctx);
      drawAimGuide(ctx, engine);
    },
  });

  game.start();
  return game;
}
