import { ArcadeEngine, THEME, Ease, drawGlow, drawRoundedRect, lerpColor } from '../../engine.js';

export function createGame(canvasId) {
  const W = 400, H = 700;

  // Ball state
  let ball = null;
  let targets = [];
  let net = { y: 280, h: 8 };
  let gameActive = false;
  let showInstruction = true;
  let servesHit = 0;
  let swipePhase = 'toss'; // 'toss' -> 'hit' -> 'flying'

  // Court colors
  const COURT_COLOR = '#1a6a2a';
  const COURT_LINE = 'rgba(255,255,255,0.6)';

  function spawnTargets() {
    targets = [];
    const count = 1 + Math.floor(servesHit / 5);
    const maxTargets = Math.min(count, 3);
    for (let i = 0; i < maxTargets; i++) {
      const size = Math.max(20, 45 - servesHit * 1.2);
      targets.push({
        x: 80 + Math.random() * (W - 160),
        y: 60 + Math.random() * 160,
        radius: size,
        moveSpeed: servesHit > 3 ? (0.5 + Math.random() * Math.min(servesHit * 0.15, 2)) : 0,
        moveAngle: Math.random() * Math.PI * 2,
        hit: false,
      });
    }
  }

  function resetBall() {
    ball = { x: W / 2, y: H - 160, vx: 0, vy: 0, radius: 10, tossY: 0, shadow: 1, scale: 1 };
    swipePhase = 'toss';
  }

  function tossBall(engine) {
    swipePhase = 'hit';
    ball.tossY = ball.y;
    engine.tweens.add(ball, { y: ball.y - 120, scale: 1.15 }, 0.4, Ease.outQuad, () => {
      // If player didn't swipe in time, ball falls
      if (swipePhase === 'hit') {
        setTimeout(() => {
          if (swipePhase === 'hit') {
            // Missed the hit window
            swipePhase = 'toss';
            engine.tweens.add(ball, { y: H - 160, scale: 1 }, 0.3, Ease.inQuad);
          }
        }, 800);
      }
    });
    engine.sound.tap();
  }

  function hitBall(dx, dy, power, engine) {
    if (swipePhase !== 'hit') return;
    swipePhase = 'flying';

    // Direction toward top of court, influenced by swipe
    const angle = Math.atan2(-1, dx * 0.003); // mostly upward
    const speed = 400 + power * 300;
    ball.vx = dx * 1.5;
    ball.vy = -speed;
    engine.sound.throw();
    engine.juice.shake(3);
  }

  function checkTargetHits(engine) {
    if (!ball || swipePhase !== 'flying') return;
    for (const t of targets) {
      if (t.hit) continue;
      const dx = ball.x - t.x;
      const dy = ball.y - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < t.radius + ball.radius) {
        t.hit = true;
        engine.addScore(1);
        servesHit++;

        // Center hit bonus
        if (dist < t.radius * 0.3) {
          engine.addScore(2);
          engine.juice.shake(8);
          engine.juice.slowMo(0.2, 0.25);
          engine.floatingText.spawn(t.x, t.y - 20, 'ACE!', { color: THEME.highlight, size: 32, duration: 1.0 });
          engine.particles.emit(t.x, t.y, 20, { speed: [4, 8], size: [3, 6], life: [0.5, 1.0], colors: [THEME.highlight, THEME.primary, '#fff'], gravity: 50, type: 'star' });
        } else {
          engine.juice.shake(4);
          engine.floatingText.spawn(t.x, t.y - 15, '+1', { color: THEME.accent, size: 22, duration: 0.7 });
          engine.particles.emit(t.x, t.y, 10, { speed: [2, 5], size: [2, 4], life: [0.3, 0.7], colors: [THEME.accent, THEME.accentLight], gravity: 40 });
        }
      }
    }
  }

  function allTargetsHit() {
    return targets.length > 0 && targets.every(t => t.hit);
  }

  // Milestone
  function checkMilestone(engine) {
    if (servesHit > 0 && servesHit % 10 === 0) {
      engine.juice.shake(10); engine.juice.flash(THEME.highlight, 0.1);
      engine.floatingText.spawn(200, 350, `${servesHit} ACES!`, { color: THEME.accent, size: 36, duration: 1.5 });
      engine.addScore(5);
      engine.particles.emit(200, 300, 20, { speed: [3, 7], size: [3, 6], life: [0.5, 1.2], colors: THEME.particles, gravity: 40, type: 'star' });
    }
  }

  function drawCourt(ctx) {
    // Far court (top half)
    ctx.fillStyle = COURT_COLOR;
    ctx.fillRect(30, 30, W - 60, net.y - 30);

    // Court lines
    ctx.strokeStyle = COURT_LINE;
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, W - 60, net.y - 30);
    // Center line
    ctx.beginPath();
    ctx.moveTo(W / 2, 30);
    ctx.lineTo(W / 2, net.y);
    ctx.stroke();
    // Service line
    ctx.beginPath();
    ctx.moveTo(30, 150);
    ctx.lineTo(W - 30, 150);
    ctx.stroke();

    // Net
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(20, net.y, W - 40, net.h);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    // Net pattern
    for (let x = 25; x < W - 25; x += 12) {
      ctx.fillRect(x, net.y - 30, 1, 30);
    }

    // Near court (bottom half — player side)
    ctx.fillStyle = '#1a5a22';
    ctx.fillRect(30, net.y + net.h, W - 60, H - net.y - net.h - 60);
    ctx.strokeStyle = COURT_LINE;
    ctx.lineWidth = 2;
    ctx.strokeRect(30, net.y + net.h, W - 60, H - net.y - net.h - 60);
  }

  function drawTargets(ctx, engine) {
    targets.forEach(t => {
      if (t.hit) return;
      const pulse = 1 + Math.sin(engine.time * 4) * 0.05;

      // Target circle
      ctx.strokeStyle = THEME.fail;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Inner ring
      ctx.strokeStyle = THEME.primary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.5 * pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Center dot
      ctx.fillStyle = THEME.highlight;
      ctx.shadowColor = THEME.highlight;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Glow
      drawGlow(ctx, t.x, t.y, t.radius * 1.5, THEME.fail);
    });
  }

  function drawBall(ctx) {
    if (!ball) return;
    // Shadow
    const shadowScale = Math.max(0.3, ball.shadow);
    ctx.globalAlpha = 0.3 * shadowScale;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(ball.x, H - 100, ball.radius * shadowScale, ball.radius * 0.4 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Ball
    const r = ball.radius * ball.scale;
    ctx.fillStyle = '#ccff00';
    ctx.shadowColor = '#ccff00';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Tennis ball seam
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ball.x - r * 0.2, ball.y, r * 0.7, -0.8, 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ball.x + r * 0.2, ball.y, r * 0.7, Math.PI - 0.8, Math.PI + 0.8);
    ctx.stroke();
  }

  function drawPhaseHint(ctx, engine) {
    if (!gameActive || swipePhase === 'flying') return;
    const alpha = 0.3 + Math.sin(engine.time * 3) * 0.2;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = THEME.textWhite;
    ctx.font = "600 16px Arial, sans-serif";
    ctx.textAlign = 'center';
    if (swipePhase === 'toss' && showInstruction) {
      ctx.fillText('TAP TO TOSS', W / 2, H - 60);
    } else if (swipePhase === 'hit') {
      ctx.fillText('SWIPE UP TO SERVE!', W / 2, H - 60);
    }
    ctx.globalAlpha = 1;
  }

  const game = new ArcadeEngine(canvasId, {
    name: 'PERFECT SERVE', width: W, height: H,

    onStateChange(newState) {
      if (newState === 'playing') {
        servesHit = 0;
        gameActive = true;
        showInstruction = true;
        resetBall();
        spawnTargets();
      }
    },

    onInput(type, data, engine) {
      if (!gameActive) return;

      if (type === 'tap' && swipePhase === 'toss') {
        showInstruction = false;
        tossBall(engine);
      }

      if (type === 'drag_end' && swipePhase === 'hit' && data.dy < -20 && data.distance > 30) {
        hitBall(data.dx, data.dy, data.power, engine);
      }
    },

    onUpdate(dt, engine) {
      if (!gameActive) return;

      // Move targets
      targets.forEach(t => {
        if (t.hit || t.moveSpeed === 0) return;
        t.x += Math.cos(t.moveAngle) * t.moveSpeed * 60 * dt;
        t.y += Math.sin(t.moveAngle) * t.moveSpeed * 30 * dt;
        // Bounce
        if (t.x < 60 || t.x > W - 60) t.moveAngle = Math.PI - t.moveAngle;
        if (t.y < 50 || t.y > net.y - 20) t.moveAngle = -t.moveAngle;
        t.x = Math.max(60, Math.min(W - 60, t.x));
        t.y = Math.max(50, Math.min(net.y - 20, t.y));
      });

      if (swipePhase === 'flying' && ball) {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.vx *= 0.99;
        ball.shadow = Math.max(0, 1 - Math.abs(ball.y - (H - 160)) / 300);
        ball.scale = 0.6 + ball.shadow * 0.4;

        checkTargetHits(engine);

        // Ball off screen or hit net
        if (ball.y < -30 || ball.x < -30 || ball.x > W + 30) {
          if (allTargetsHit()) {
            checkMilestone(engine);
            resetBall();
            spawnTargets();
          } else {
            // Missed — game over
            gameActive = false;
            engine.sound.miss();
            engine.juice.shake(6);
            engine.juice.flash(THEME.fail, 0.2);
            setTimeout(() => engine.setState('gameover'), 400);
          }
        }

        // Hit the net
        if (ball.y > net.y - 5 && ball.y < net.y + net.h + 5 && ball.vy < 0) {
          // Ball hits net from player side going up — it should clear net
          // Actually net is between courts, ball going up should pass over
        }

        // Ball going past net.y means it crossed — check if going down past net
        if (ball.y > net.y + net.h && ball.vy > 0) {
          // Ball came back down on player side — fault
          gameActive = false;
          engine.sound.miss();
          engine.juice.shake(4);
          engine.juice.flash(THEME.fail, 0.15);
          setTimeout(() => engine.setState('gameover'), 400);
        }

        // All targets hit while ball still in play
        if (allTargetsHit() && ball.y < net.y) {
          checkMilestone(engine);
          resetBall();
          spawnTargets();
        }
      }
    },

    onDraw(ctx, engine) {
      drawCourt(ctx);
      drawTargets(ctx, engine);
      drawBall(ctx);
      drawPhaseHint(ctx, engine);
    },
  });

  game.start();
  return game;
}
