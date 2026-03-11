import { ArcadeEngine, THEME, Ease, drawGlow, drawRoundedRect, lerpColor } from '../../engine.js';

export function createGame(canvasId) {
  const W = 400, H = 700;

  // Runner
  let runner = {
    x: 120, y: 0, vy: 0, width: 20, height: 32,
    grounded: true, jumpPower: -520, gravity: 1400,
    runSpeed: 160, legCycle: 0, squash: 1,
  };

  let cameraX = 0;
  let buildings = [];
  let skyline = [];
  let roofsCrossed = 0;
  let gameActive = false;
  let showInstruction = true;
  let windForce = 0;
  let windTimer = 0;
  let currentBuildingIdx = 0;

  const BASE_RUN_SPEED = 160;
  const BASE_GAP = 50;
  const BASE_WIDTH = 100;

  const BUILDING_COLORS = ['#1a1a3e', '#1e1e45', '#22224d', '#181840', '#2a1a40'];
  const WINDOW_COLORS = [THEME.highlight + '30', THEME.accentDark + '25', THEME.primary + '20', '#ffffff15'];

  function generateBuilding(x, prevHeight) {
    const difficulty = Math.min(roofsCrossed / 40, 1);
    const minW = Math.max(40, BASE_WIDTH - difficulty * 50);
    const maxW = Math.max(60, 140 - difficulty * 60);
    const w = minW + Math.random() * (maxW - minW);
    let h;
    if (prevHeight) {
      h = Math.max(180, Math.min(420, prevHeight + (Math.random() - 0.5) * 160));
    } else {
      h = 280 + Math.random() * 100;
    }
    const minGap = Math.max(30, BASE_GAP - difficulty * 10);
    const maxGap = BASE_GAP + 30 + difficulty * 60;
    const gap = minGap + Math.random() * (maxGap - minGap);
    return {
      x, w, h, gap,
      color: BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)],
      windowColor: WINDOW_COLORS[Math.floor(Math.random() * WINDOW_COLORS.length)],
      windowCols: Math.max(1, Math.floor(w / 25)),
      windowRows: Math.max(2, Math.floor(h / 30)),
      hasAntenna: Math.random() > 0.6,
      antennaHeight: 15 + Math.random() * 25,
      hasWaterTank: Math.random() > 0.7 && w > 60,
      scored: false,
    };
  }

  function generateSkyline() {
    skyline = [];
    for (let i = 0; i < 30; i++) {
      skyline.push({ x: i * 80 - 200, w: 30 + Math.random() * 50, h: 80 + Math.random() * 200, color: Math.random() > 0.5 ? '#0d0d25' : '#0f0f2a' });
    }
  }

  function initBuildings() {
    buildings = [];
    let x = 0;
    const first = generateBuilding(x, 300);
    first.w = 160; first.h = 300; first.gap = 50;
    buildings.push(first);
    x += first.w + first.gap;
    for (let i = 0; i < 15; i++) {
      const b = generateBuilding(x, buildings[buildings.length - 1].h);
      buildings.push(b);
      x += b.w + b.gap;
    }
  }

  function ensureBuildings() {
    const lastB = buildings[buildings.length - 1];
    if (lastB.x + lastB.w < cameraX + W + 200) {
      let x = lastB.x + lastB.w + lastB.gap;
      for (let i = 0; i < 5; i++) {
        const b = generateBuilding(x, buildings[buildings.length - 1].h);
        buildings.push(b);
        x += b.w + b.gap;
      }
    }
    while (buildings.length > 3 && buildings[0].x + buildings[0].w < cameraX - 100) {
      buildings.shift();
      currentBuildingIdx = Math.max(0, currentBuildingIdx - 1);
    }
  }

  function getBuildingAt(worldX) {
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (worldX >= b.x && worldX <= b.x + b.w) return { building: b, index: i };
    }
    return null;
  }

  function getRooftopY(building) { return H - building.h; }

  // Drawing
  function drawSkylineParallax(ctx) {
    skyline.forEach(b => {
      const wrappedX = ((b.x - cameraX * 0.15 + 400) % 2400) - 400;
      ctx.fillStyle = b.color;
      ctx.fillRect(wrappedX, H - b.h, b.w, b.h);
    });
  }

  function drawBuildings(ctx, engine) {
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const sx = b.x - cameraX;
      const sy = H - b.h;
      if (sx + b.w < -20 || sx > W + 20) continue;

      ctx.fillStyle = b.color;
      ctx.fillRect(sx, sy, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(sx, sy, 2, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(sx, sy, b.w, 2);

      const winW = 8, winH = 10;
      const padX = (b.w - b.windowCols * 20) / 2 + 6;
      for (let row = 0; row < b.windowRows; row++) {
        for (let col = 0; col < b.windowCols; col++) {
          const wx = sx + padX + col * 20;
          const wy = sy + 15 + row * 25;
          if (wy > H - 5) continue;
          ctx.fillStyle = ((row + col + i) % 3 === 0) ? b.windowColor : 'rgba(255,255,255,0.03)';
          ctx.fillRect(wx, wy, winW, winH);
        }
      }

      if (b.hasAntenna) {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        const ax = sx + b.w * 0.7;
        ctx.beginPath();
        ctx.moveTo(ax, sy);
        ctx.lineTo(ax, sy - b.antennaHeight);
        ctx.stroke();
        if (Math.sin(engine.time * 4 + i) > 0.5) {
          ctx.fillStyle = THEME.fail;
          ctx.shadowColor = THEME.fail;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(ax, sy - b.antennaHeight, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      if (b.hasWaterTank) {
        const tx = sx + 10;
        ctx.fillStyle = '#2a2a50';
        ctx.fillRect(tx, sy - 18, 18, 14);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, sy - 18, 18, 14);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.moveTo(tx + 3, sy - 4);
        ctx.lineTo(tx + 3, sy);
        ctx.moveTo(tx + 15, sy - 4);
        ctx.lineTo(tx + 15, sy);
        ctx.stroke();
      }
    }
  }

  function drawRunner(ctx, engine) {
    const sx = runner.x - cameraX;
    const sy = runner.y;
    ctx.save();
    ctx.translate(sx, sy);

    const glowColor = engine.combo > 5 ? THEME.highlight : THEME.primary;
    drawGlow(ctx, 0, -runner.height / 2, 30 + Math.min(engine.combo * 2, 20), glowColor);

    const stretchY = runner.squash;
    const stretchX = 1 / Math.sqrt(stretchY);
    ctx.scale(stretchX, stretchY);

    const bodyGrad = ctx.createLinearGradient(0, -runner.height, 0, 0);
    bodyGrad.addColorStop(0, THEME.primary);
    bodyGrad.addColorStop(1, THEME.primaryDark);
    ctx.fillStyle = bodyGrad;
    drawRoundedRect(ctx, -runner.width / 2, -runner.height, runner.width, runner.height - 8, 6);
    ctx.fill();

    ctx.fillStyle = '#F5C5A3';
    ctx.beginPath();
    ctx.arc(0, -runner.height - 6, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = THEME.accentDark;
    ctx.beginPath();
    ctx.arc(0, -runner.height - 8, 8, Math.PI, 0);
    ctx.fill();

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    if (runner.grounded) {
      runner.legCycle += 12 * (runner.runSpeed / BASE_RUN_SPEED);
      const legAngle = Math.sin(runner.legCycle * 0.15) * 0.5;
      ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(-3 + Math.sin(legAngle) * 10, 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, -4); ctx.lineTo(3 + Math.sin(legAngle + Math.PI) * 10, 8); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(-8, 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(8, 2); ctx.stroke();
    }

    ctx.strokeStyle = THEME.primaryDark;
    ctx.lineWidth = 3;
    if (!runner.grounded) {
      ctx.beginPath(); ctx.moveTo(-runner.width / 2, -runner.height + 8); ctx.lineTo(-runner.width / 2 - 10, -runner.height - 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(runner.width / 2, -runner.height + 8); ctx.lineTo(runner.width / 2 + 10, -runner.height - 2); ctx.stroke();
    } else {
      const armSwing = Math.sin(runner.legCycle * 0.15) * 8;
      ctx.beginPath(); ctx.moveTo(-runner.width / 2, -runner.height + 10); ctx.lineTo(-runner.width / 2 - 6, -runner.height + 18 + armSwing); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(runner.width / 2, -runner.height + 10); ctx.lineTo(runner.width / 2 + 6, -runner.height + 18 - armSwing); ctx.stroke();
    }
    ctx.restore();
  }

  function drawWindIndicator(ctx, engine) {
    if (Math.abs(windForce) < 10) return;
    const alpha = Math.min(Math.abs(windForce) / 100, 0.6);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = THEME.accentDark;
    ctx.font = "bold 14px 'Arial Black',Impact,sans-serif";
    ctx.textAlign = 'center';
    const dir = windForce > 0 ? '→' : '←';
    const arrows = Math.abs(windForce) > 80 ? `${dir}${dir}${dir}` : Math.abs(windForce) > 40 ? `${dir}${dir}` : dir;
    ctx.fillText(`WIND ${arrows}`, W / 2, 140);
    for (let i = 0; i < 5; i++) {
      const wx = ((engine.time * windForce * 2 + i * 120) % (W + 100)) - 50;
      const wy = 150 + i * 30 + Math.sin(engine.time * 3 + i) * 15;
      ctx.strokeStyle = THEME.accentDark;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + windForce * 0.3, wy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawInstruction(ctx, engine) {
    if (!showInstruction) return;
    const alpha = 0.3 + Math.sin(engine.time * 3) * 0.25;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = THEME.textWhite;
    ctx.font = "600 16px Arial, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('TAP TO JUMP', W / 2, H * 0.45);
    ctx.globalAlpha = 1;
  }

  generateSkyline();

  const game = new ArcadeEngine(canvasId, {
    name: 'ROOF HOPPER',
    width: W,
    height: H,

    onStateChange(newState) {
      if (newState === 'playing') {
        runner.x = 120; runner.vy = 0; runner.grounded = true;
        runner.runSpeed = BASE_RUN_SPEED; runner.squash = 1;
        runner.legCycle = 0;
        cameraX = 0; roofsCrossed = 0; currentBuildingIdx = 0;
        windForce = 0; windTimer = 0;
        gameActive = true; showInstruction = true;
        initBuildings();
        runner.y = getRooftopY(buildings[0]);
      }
    },

    onInput(type, data, engine) {
      if (type === 'tap' && gameActive) {
        showInstruction = false;
        if (runner.grounded) {
          runner.vy = runner.jumpPower;
          runner.grounded = false;
          runner.squash = 1.3;
          engine.sound.tap();
          engine.particles.emit(runner.x - cameraX, runner.y, 6, {
            speed: [1, 3], size: [2, 4], life: [0.2, 0.5],
            colors: ['#fff', THEME.textDim], gravity: 100,
            spread: Math.PI * 0.6, angle: -Math.PI / 2,
          });
        }
      }
    },

    onUpdate(dt, engine) {
      if (!gameActive) return;

      runner.x += runner.runSpeed * dt;
      cameraX += ((runner.x - 120) - cameraX) * dt * 5;

      if (!runner.grounded) {
        runner.vy += runner.gravity * dt;
        if (Math.abs(windForce) > 0) runner.x += windForce * dt;
        runner.y += runner.vy * dt;
      }

      if (runner.squash !== 1) {
        runner.squash += (1 - runner.squash) * dt * 10;
        if (Math.abs(runner.squash - 1) < 0.01) runner.squash = 1;
      }

      if (!runner.grounded && runner.vy > 0) {
        const result = getBuildingAt(runner.x);
        if (result) {
          const roofY = getRooftopY(result.building);
          if (runner.y >= roofY && runner.y < roofY + 40) {
            runner.y = roofY; runner.vy = 0; runner.grounded = true; runner.squash = 0.7;
            if (!result.building.scored && result.index > 0) {
              result.building.scored = true;
              roofsCrossed++;
              engine.addScore(1);
              const sx = runner.x - cameraX;
              engine.particles.emit(sx, roofY, 10, {
                speed: [2, 5], size: [2, 4], life: [0.3, 0.7],
                colors: [THEME.accent, THEME.accentLight, '#fff'],
                gravity: 80, spread: Math.PI * 0.8, angle: -Math.PI / 2,
              });
              const distToEdge = Math.min(runner.x - result.building.x, result.building.x + result.building.w - runner.x);
              if (distToEdge < 15) {
                engine.juice.slowMo(0.3, 0.2);
                engine.floatingText.spawn(sx, roofY - 40, 'CLOSE!', { color: THEME.highlight, size: 26, duration: 0.8 });
                engine.addScore(1);
                engine.juice.shake(4);
              }
              if (roofsCrossed > 0 && roofsCrossed % 10 === 0) {
                engine.juice.shake(10);
                engine.juice.flash(THEME.highlight, 0.12);
                engine.floatingText.spawn(W / 2, H * 0.3, `${roofsCrossed} ROOFS!`, { color: THEME.accent, size: 36, duration: 1.5 });
                engine.addScore(5);
                engine.particles.emit(W / 2, H * 0.35, 20, { speed: [3, 7], size: [3, 6], life: [0.5, 1.2], colors: THEME.particles, gravity: 40, type: 'star' });
              }
              runner.runSpeed = BASE_RUN_SPEED + Math.min(roofsCrossed * 3, 120);
            }
            currentBuildingIdx = result.index;
          }
        }
      }

      if (runner.grounded && !getBuildingAt(runner.x)) {
        runner.grounded = false;
        runner.vy = 0;
      }

      if (runner.y > H + 50) {
        gameActive = false;
        engine.sound.miss();
        engine.juice.shake(8);
        engine.juice.flash(THEME.fail, 0.2);
        setTimeout(() => engine.setState('gameover'), 300);
        return;
      }

      if (roofsCrossed >= 15) {
        windTimer -= dt;
        if (windTimer <= 0) {
          windForce = (Math.random() - 0.5) * Math.min(60 + roofsCrossed * 2, 200);
          windTimer = 3 + Math.random() * 4;
        }
      }

      ensureBuildings();
    },

    onDraw(ctx, engine) {
      drawSkylineParallax(ctx);
      drawBuildings(ctx, engine);
      drawRunner(ctx, engine);
      drawWindIndicator(ctx, engine);
      drawInstruction(ctx, engine);
    },
  });

  game.start();
  return game;
}
