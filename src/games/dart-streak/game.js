import { ArcadeEngine, THEME, Ease, drawGlow, drawRoundedRect, lerpColor } from '../../engine.js';

export function createGame(canvasId) {
  const W = 400, H = 700;

  let board = {
    x: 200, y: 240, radius: 110, rotation: 0, spinSpeed: 0,
    moveX: 0, moveSpeedX: 0, moveAmplitudeX: 0,
    moveY: 0, moveSpeedY: 0, moveAmplitudeY: 0, scale: 1,
  };

  let dart = null;
  let dartReady = true;
  let dartsThrown = 0;
  let gameActive = false;
  let showInstruction = true;
  let stuckDarts = [];

  const RINGS = [
    { r: 0.08, label: 'BULLSEYE', points: 5, color: THEME.fail },
    { r: 0.18, label: 'INNER BULL', points: 3 },
    { r: 0.45, label: 'TREBLE', points: 2 },
    { r: 0.72, label: 'SINGLE', points: 1 },
    { r: 1.0,  label: 'OUTER', points: 1 },
  ];

  function resetBoard() {
    board.x = 200; board.y = 240; board.radius = 110; board.rotation = 0;
    board.spinSpeed = 0; board.moveAmplitudeX = 0; board.moveSpeedX = 0;
    board.moveAmplitudeY = 0; board.moveSpeedY = 0; board.scale = 1;
  }

  function updateDifficulty() {
    const t = dartsThrown;
    if (t >= 3) {
      board.moveAmplitudeX = Math.min(30 + t * 3, 100);
      board.moveSpeedX = 1.5 + Math.min(t * 0.1, 2);
    }
    if (t >= 8) {
      board.moveAmplitudeY = Math.min(15 + (t - 8) * 2, 50);
      board.moveSpeedY = 1.0 + Math.min((t - 8) * 0.08, 1.5);
    }
    if (t >= 12) {
      board.spinSpeed = Math.min((t - 12) * 0.15, 2.5);
    }
    if (t >= 5) {
      board.scale = Math.max(0.55, 1 - (t - 5) * 0.02);
    }
  }

  function checkDartHit(engine) {
    if (!dart) return false;
    const bx = board.x + Math.sin(engine.time * board.moveSpeedX) * board.moveAmplitudeX;
    const by = board.y + Math.sin(engine.time * board.moveSpeedY) * board.moveAmplitudeY;
    const br = board.radius * board.scale;
    const dx = dart.x - bx;
    const dy = dart.y - by;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= br) {
      const normDist = dist / br;
      let hitRing = RINGS[RINGS.length - 1];
      for (let i = 0; i < RINGS.length; i++) {
        if (normDist <= RINGS[i].r) { hitRing = RINGS[i]; break; }
      }

      stuckDarts.push({ relAngle: Math.atan2(dy, dx) - board.rotation, relDist: dist, life: 3 });
      engine.addScore(hitRing.points);
      dartsThrown++;
      updateDifficulty();

      const hitX = dart.x, hitY = dart.y;
      if (hitRing.label === 'BULLSEYE') {
        engine.juice.shake(10); engine.juice.slowMo(0.2, 0.3); engine.juice.flash(THEME.highlight, 0.15);
        engine.particles.emit(hitX, hitY, 25, { speed: [4, 9], size: [3, 6], life: [0.5, 1.2], colors: [THEME.highlight, THEME.primary, THEME.fail], gravity: 60, type: 'star' });
        engine.floatingText.spawn(hitX, hitY - 30, 'BULLSEYE!', { color: THEME.highlight, size: 32, duration: 1.2 });
        engine.addScore(5);
      } else if (hitRing.label === 'INNER BULL') {
        engine.juice.shake(6);
        engine.particles.emit(hitX, hitY, 15, { speed: [3, 7], size: [2, 5], life: [0.4, 0.9], colors: [THEME.accent, THEME.accentLight], gravity: 50 });
        engine.floatingText.spawn(hitX, hitY - 25, 'INNER BULL!', { color: THEME.accent, size: 26, duration: 1.0 });
      } else if (hitRing.label === 'TREBLE') {
        engine.juice.shake(4);
        engine.particles.emit(hitX, hitY, 10, { speed: [2, 5], size: [2, 4], life: [0.3, 0.7], colors: [THEME.primary, THEME.primaryLight], gravity: 40 });
        engine.floatingText.spawn(hitX, hitY - 20, '+2', { color: THEME.primary, size: 22, duration: 0.8 });
      } else {
        engine.particles.emit(hitX, hitY, 6, { speed: [1, 3], size: [2, 3], life: [0.2, 0.5], colors: ['#fff', THEME.textDim], gravity: 30 });
        engine.floatingText.spawn(hitX, hitY - 20, '+1', { color: THEME.textWhite, size: 18, duration: 0.6 });
      }

      if (dartsThrown > 0 && dartsThrown % 10 === 0) {
        engine.juice.shake(12); engine.juice.flash(THEME.highlight, 0.12);
        engine.floatingText.spawn(200, 450, `${dartsThrown} DARTS!`, { color: THEME.accent, size: 36, duration: 1.5 });
        engine.addScore(5);
        engine.particles.emit(200, 400, 20, { speed: [3, 7], size: [3, 6], life: [0.5, 1.2], colors: THEME.particles, gravity: 40, type: 'star' });
      }

      dart = null;
      dartReady = true;
      return true;
    }
    return false;
  }

  function drawBoard(ctx, engine) {
    const bx = board.x + Math.sin(engine.time * board.moveSpeedX) * board.moveAmplitudeX;
    const by = board.y + Math.sin(engine.time * board.moveSpeedY) * board.moveAmplitudeY;
    const br = board.radius * board.scale;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(board.rotation);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(4, 4, br + 5, 0, Math.PI * 2); ctx.fill();

    const boardGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, br);
    boardGrad.addColorStop(0, '#3a2a1a'); boardGrad.addColorStop(1, '#2a1a0a');
    ctx.fillStyle = boardGrad;
    ctx.beginPath(); ctx.arc(0, 0, br + 4, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, br, 0, Math.PI * 2); ctx.stroke();

    const numSegments = 20;
    for (let i = 0; i < numSegments; i++) {
      const a1 = (i / numSegments) * Math.PI * 2 - Math.PI / numSegments;
      const a2 = ((i + 1) / numSegments) * Math.PI * 2 - Math.PI / numSegments;

      ctx.fillStyle = i % 2 === 0 ? '#1a1a3e' : '#2a2a5a';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, br, a1, a2); ctx.closePath(); ctx.fill();

      ctx.fillStyle = i % 2 === 0 ? '#cc3333' : '#1a6a2a';
      ctx.beginPath(); ctx.arc(0, 0, br * 0.45, a1, a2); ctx.arc(0, 0, br * 0.38, a2, a1, true); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, br, a1, a2); ctx.arc(0, 0, br * 0.9, a2, a1, true); ctx.closePath(); ctx.fill();

      ctx.strokeStyle = 'rgba(180,180,180,0.3)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a1) * br, Math.sin(a1) * br); ctx.stroke();
    }

    [0.18, 0.38, 0.45, 0.72, 0.9].forEach(r => {
      ctx.strokeStyle = 'rgba(180,180,180,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, br * r, 0, Math.PI * 2); ctx.stroke();
    });

    ctx.fillStyle = '#1a6a2a';
    ctx.beginPath(); ctx.arc(0, 0, br * 0.18, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = THEME.fail; ctx.shadowColor = THEME.fail; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(0, 0, br * 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    stuckDarts.forEach(sd => {
      const sdx = Math.cos(sd.relAngle) * sd.relDist;
      const sdy = Math.sin(sd.relAngle) * sd.relDist;
      ctx.globalAlpha = Math.min(1, sd.life);
      ctx.fillStyle = '#888';
      ctx.beginPath(); ctx.arc(sdx, sdy, 3, 0, Math.PI * 2); ctx.fill();
      const fa = sd.relAngle + Math.PI;
      ctx.strokeStyle = THEME.primary; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sdx, sdy); ctx.lineTo(sdx + Math.cos(fa) * 12, sdy + Math.sin(fa) * 12); ctx.stroke();
      ctx.globalAlpha = 1;
    });

    ctx.restore();
  }

  function drawDart(ctx) {
    if (!dart) return;
    for (let i = 0; i < dart.trail.length; i++) {
      const t = dart.trail[i];
      ctx.globalAlpha = (i / dart.trail.length) * 0.3;
      ctx.fillStyle = THEME.primary;
      ctx.beginPath(); ctx.arc(t.x, t.y, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(dart.x, dart.y);
    ctx.rotate(dart.rotation);

    ctx.fillStyle = '#ddd';
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(-3, 0); ctx.lineTo(3, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#888'; ctx.fillRect(-2.5, 0, 5, 10);
    ctx.fillStyle = THEME.primary;
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-8, 18); ctx.lineTo(0, 15); ctx.lineTo(8, 18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = THEME.primaryLight; ctx.shadowColor = THEME.primaryLight; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(0, -14, 2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function drawAimGuide(ctx, engine) {
    if (!dartReady || !gameActive) return;
    const alpha = 0.2 + Math.sin(engine.time * 3) * 0.15;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = THEME.primary;
    ctx.beginPath(); ctx.arc(200, 600, 30, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = THEME.textWhite; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(200, 615); ctx.lineTo(200, 585); ctx.lineTo(192, 593);
    ctx.moveTo(200, 585); ctx.lineTo(208, 593); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawInstruction(ctx, engine) {
    if (!showInstruction) return;
    const alpha = 0.3 + Math.sin(engine.time * 3) * 0.25;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = THEME.textWhite;
    ctx.font = "600 16px Arial, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('FLICK UP TO THROW', 200, 530);
    ctx.globalAlpha = 1;
  }

  const game = new ArcadeEngine(canvasId, {
    name: 'DART STREAK',
    width: W, height: H,

    onStateChange(newState) {
      if (newState === 'playing') {
        resetBoard();
        dart = null; dartReady = true; dartsThrown = 0;
        stuckDarts = []; gameActive = true; showInstruction = true;
      }
    },

    onInput(type, data, engine) {
      if (type === 'drag_end' && gameActive && dartReady) {
        showInstruction = false;
        if (data.dy < -20 && data.distance > 30) {
          dartReady = false;
          const speed = 600 + data.power * 200;
          const angle = Math.atan2(data.dy, data.dx);
          dart = {
            x: data.startX, y: data.startY,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            rotation: angle - Math.PI / 2, life: 0, trail: [],
          };
          engine.sound.throw();
        }
      }
    },

    onUpdate(dt, engine) {
      if (!gameActive) return;
      board.rotation += board.spinSpeed * dt;

      for (let i = stuckDarts.length - 1; i >= 0; i--) {
        stuckDarts[i].life -= dt;
        if (stuckDarts[i].life <= 0) stuckDarts.splice(i, 1);
      }

      if (dart) {
        dart.life += dt;
        dart.vy += 50 * dt;
        dart.x += dart.vx * dt;
        dart.y += dart.vy * dt;
        dart.rotation = Math.atan2(dart.vy, dart.vx) - Math.PI / 2;
        dart.trail.push({ x: dart.x, y: dart.y });
        if (dart.trail.length > 8) dart.trail.shift();

        if (checkDartHit(engine)) return;

        if (dart.y < -50 || dart.y > H + 50 || dart.x < -50 || dart.x > W + 50 || dart.life > 2) {
          dart = null;
          gameActive = false;
          engine.sound.miss();
          engine.juice.shake(6);
          engine.juice.flash(THEME.fail, 0.2);
          setTimeout(() => engine.setState('gameover'), 400);
        }
      }
    },

    onDraw(ctx, engine) {
      drawBoard(ctx, engine);
      drawDart(ctx);
      drawAimGuide(ctx, engine);
      drawInstruction(ctx, engine);
    },
  });

  game.start();
  return game;
}
