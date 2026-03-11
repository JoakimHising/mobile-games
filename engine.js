/**
 * ARCADE ENGINE v1.0
 * Shared game engine for casual mobile arcade games.
 * Bold & Vibrant visual style.
 *
 * Usage:
 *   const game = new ArcadeEngine('canvasId', {
 *     onUpdate(dt, state) { ... },
 *     onDraw(ctx, state) { ... },
 *     onInput(type, data, state) { ... },  // 'tap', 'drag_start', 'drag_move', 'drag_end'
 *     onStateChange(newState, oldState) { ... },
 *   });
 *   game.start();
 */

// ============================================================
// THEME — Bold & Vibrant palette
// ============================================================
const THEME = {
  // Backgrounds
  bgDark: '#0A0A1A',
  bgGrad1: '#0F0C29',
  bgGrad2: '#1A1A3E',

  // Primary colors
  primary: '#FF6B35',
  primaryLight: '#FF9F1C',
  primaryDark: '#CC4420',

  // Accent colors
  accent: '#00F5D4',
  accentLight: '#00FFE0',
  accentDark: '#00BBF9',

  // Highlight
  highlight: '#FEE440',
  highlightDark: '#E6CC00',

  // Feedback
  success: '#00F5D4',
  fail: '#FF006E',

  // Text
  textWhite: '#FFFFFF',
  textDim: 'rgba(255,255,255,0.4)',

  // Particles
  particles: ['#FF006E', '#FB5607', '#FFBE0B', '#00F5D4', '#8338EC', '#FF6B35'],

  // UI
  uiBg: 'rgba(10, 10, 26, 0.85)',
  uiBorder: 'rgba(255, 255, 255, 0.1)',
  uiButton: '#FF6B35',
  uiButtonHover: '#FF9F1C',
};

// ============================================================
// EASING FUNCTIONS
// ============================================================
const Ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => t * (2 - t),
  inOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  outCubic: t => (--t) * t * t + 1,
  outBack: t => { const s = 1.70158; return (t -= 1) * t * ((s + 1) * t + s) + 1; },
  outElastic: t => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
  },
  outBounce: t => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
};

// ============================================================
// OBJECT POOL — avoids garbage collection pauses
// ============================================================
class Pool {
  constructor(factory, reset, initialSize = 50) {
    this.factory = factory;
    this.resetFn = reset;
    this.pool = [];
    this.active = [];
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  get() {
    const obj = this.pool.length > 0 ? this.pool.pop() : this.factory();
    this.active.push(obj);
    return obj;
  }

  release(obj) {
    const idx = this.active.indexOf(obj);
    if (idx !== -1) {
      this.active.splice(idx, 1);
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }

  releaseAll() {
    while (this.active.length > 0) {
      const obj = this.active.pop();
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }

  forEach(fn) {
    // Iterate backwards so we can release during iteration
    for (let i = this.active.length - 1; i >= 0; i--) {
      fn(this.active[i], i);
    }
  }

  get count() { return this.active.length; }
}

// ============================================================
// PARTICLE SYSTEM
// ============================================================
class ParticleSystem {
  constructor() {
    this.pool = new Pool(
      () => ({ x: 0, y: 0, vx: 0, vy: 0, size: 0, life: 0, maxLife: 1, color: '#fff', gravity: 0, drag: 1, type: 'circle' }),
      (p) => { p.life = 0; },
      200
    );
  }

  emit(x, y, count, options = {}) {
    const {
      speed = [2, 5],
      size = [2, 5],
      life = [0.5, 1.2],
      colors = THEME.particles,
      gravity = 0,
      drag = 0.98,
      spread = Math.PI * 2,
      angle = -Math.PI / 2,
      type = 'circle',
    } = options;

    for (let i = 0; i < count; i++) {
      const p = this.pool.get();
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed[0] + Math.random() * (speed[1] - speed[0]);
      p.x = x + (Math.random() - 0.5) * 6;
      p.y = y + (Math.random() - 0.5) * 6;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.size = size[0] + Math.random() * (size[1] - size[0]);
      p.maxLife = life[0] + Math.random() * (life[1] - life[0]);
      p.life = p.maxLife;
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.gravity = gravity;
      p.drag = drag;
      p.type = type;
    }
  }

  update(dt) {
    this.pool.forEach((p) => {
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.release(p);
        return;
      }
      p.vy += p.gravity * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx;
      p.y += p.vy;
    });
  }

  draw(ctx) {
    this.pool.forEach((p) => {
      const alpha = Math.max(0, p.life / p.maxLife);
      const sizeScale = 0.3 + alpha * 0.7;
      ctx.globalAlpha = alpha;

      if (p.type === 'circle') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * sizeScale, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'square') {
        ctx.fillStyle = p.color;
        const s = p.size * sizeScale;
        ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
      } else if (p.type === 'star') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        drawStar(ctx, p.x, p.y, 5, p.size * sizeScale, p.size * sizeScale * 0.5);
        ctx.fill();
      }
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  clear() {
    this.pool.releaseAll();
  }
}

function drawStar(ctx, cx, cy, spikes, outerR, innerR) {
  let rot = -Math.PI / 2;
  const step = Math.PI / spikes;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(rot) * r;
    const y = cy + Math.sin(rot) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    rot += step;
  }
  ctx.closePath();
}

// ============================================================
// JUICE — Screen effects
// ============================================================
class Juice {
  constructor() {
    this.shakeAmount = 0;
    this.shakeDecay = 0.9;
    this.flashAlpha = 0;
    this.flashColor = '#fff';
    this.slowMotion = 1;
    this.slowMotionTarget = 1;
  }

  shake(amount = 8) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  flash(color = '#fff', alpha = 0.3) {
    this.flashColor = color;
    this.flashAlpha = alpha;
  }

  slowMo(factor = 0.2, duration = 0.3) {
    this.slowMotion = factor;
    this.slowMotionTarget = 1;
    this._slowMoDuration = duration;
    this._slowMoTimer = 0;
  }

  update(dt) {
    if (this.shakeAmount > 0) {
      this.shakeAmount *= this.shakeDecay;
      if (this.shakeAmount < 0.5) this.shakeAmount = 0;
    }
    if (this.flashAlpha > 0) {
      this.flashAlpha -= dt * 3;
      if (this.flashAlpha < 0) this.flashAlpha = 0;
    }
    if (this.slowMotion < this.slowMotionTarget) {
      this._slowMoTimer += dt;
      if (this._slowMoTimer >= this._slowMoDuration) {
        this.slowMotion = 1;
      } else {
        this.slowMotion += (1 - this.slowMotion) * dt * 3;
      }
    }
  }

  applyShake(ctx) {
    if (this.shakeAmount > 0) {
      const sx = (Math.random() - 0.5) * this.shakeAmount;
      const sy = (Math.random() - 0.5) * this.shakeAmount;
      ctx.translate(sx, sy);
    }
  }

  drawFlash(ctx, w, h) {
    if (this.flashAlpha > 0) {
      ctx.fillStyle = this.flashColor;
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  getTimeScale() {
    return this.slowMotion;
  }
}

// ============================================================
// SOUND — Procedural audio (no files needed)
// ============================================================
class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.3;
    this._initialized = false;
  }

  init() {
    if (this._initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._initialized = true;
    } catch (e) {
      this.enabled = false;
    }
  }

  _play(freq, type, duration, vol = 1, slide = 0) {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(freq + slide, this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(this.volume * vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // Pre-defined game sounds
  throw() { this._play(220, 'sine', 0.15, 0.4, 200); }
  score() { this._play(523, 'sine', 0.1, 0.5); setTimeout(() => this._play(659, 'sine', 0.1, 0.5), 80); setTimeout(() => this._play(784, 'sine', 0.15, 0.5), 160); }
  combo(level) { const base = 523 + level * 60; this._play(base, 'sine', 0.1, 0.5); setTimeout(() => this._play(base * 1.25, 'sine', 0.1, 0.5), 60); setTimeout(() => this._play(base * 1.5, 'sine', 0.2, 0.6), 120); }
  miss() { this._play(200, 'sawtooth', 0.2, 0.3, -100); }
  tap() { this._play(800, 'sine', 0.05, 0.2); }
  gameOver() { this._play(400, 'sawtooth', 0.15, 0.4, -80); setTimeout(() => this._play(300, 'sawtooth', 0.15, 0.4, -80), 150); setTimeout(() => this._play(200, 'sawtooth', 0.3, 0.4, -100), 300); }
  newBest() { for (let i = 0; i < 5; i++) setTimeout(() => this._play(523 + i * 80, 'sine', 0.12, 0.4), i * 80); }
  click() { this._play(600, 'sine', 0.04, 0.15); }
}

// ============================================================
// TWEEN SYSTEM
// ============================================================
class TweenManager {
  constructor() {
    this.tweens = [];
  }

  add(target, props, duration, ease = Ease.outCubic, onComplete = null) {
    const tween = {
      target,
      startProps: {},
      endProps: props,
      duration,
      elapsed: 0,
      ease,
      onComplete,
    };
    for (const key in props) {
      tween.startProps[key] = target[key];
    }
    this.tweens.push(tween);
    return tween;
  }

  update(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const t = this.tweens[i];
      t.elapsed += dt;
      const progress = Math.min(t.elapsed / t.duration, 1);
      const easedProgress = t.ease(progress);

      for (const key in t.endProps) {
        t.target[key] = t.startProps[key] + (t.endProps[key] - t.startProps[key]) * easedProgress;
      }

      if (progress >= 1) {
        this.tweens.splice(i, 1);
        if (t.onComplete) t.onComplete();
      }
    }
  }

  clear() {
    this.tweens = [];
  }
}

// ============================================================
// FLOATING TEXT (score popups, combo text)
// ============================================================
class FloatingTextManager {
  constructor() {
    this.pool = new Pool(
      () => ({ x: 0, y: 0, text: '', color: '#fff', size: 24, life: 0, maxLife: 1, vy: -40, scale: 1, glow: true }),
      (t) => { t.life = 0; },
      30
    );
  }

  spawn(x, y, text, options = {}) {
    const t = this.pool.get();
    t.x = x;
    t.y = y;
    t.text = text;
    t.color = options.color || THEME.success;
    t.size = options.size || 24;
    t.maxLife = options.duration || 1;
    t.life = t.maxLife;
    t.vy = options.vy || -50;
    t.scale = options.scale || 1;
    t.glow = options.glow !== false;
    return t;
  }

  update(dt) {
    this.pool.forEach((t) => {
      t.life -= dt;
      if (t.life <= 0) {
        this.pool.release(t);
        return;
      }
      t.y += t.vy * dt;
    });
  }

  draw(ctx) {
    this.pool.forEach((t) => {
      const alpha = Math.max(0, t.life / t.maxLife);
      const scaleAnim = t.scale * (0.8 + Ease.outBack(1 - alpha) * 0.4);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color;
      if (t.glow) {
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 15;
      }
      ctx.font = `bold ${t.size * scaleAnim}px 'Arial Black', 'Impact', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;
  }

  clear() {
    this.pool.releaseAll();
  }
}

// ============================================================
// INPUT HANDLER
// ============================================================
class InputHandler {
  constructor(canvas, canvasWidth, canvasHeight) {
    this.canvas = canvas;
    this.cw = canvasWidth;
    this.ch = canvasHeight;
    this.listeners = [];
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.dragCurrent = { x: 0, y: 0 };
    this._callbacks = { tap: [], drag_start: [], drag_move: [], drag_end: [] };

    this._bindEvents();
  }

  on(event, callback) {
    if (this._callbacks[event]) {
      this._callbacks[event].push(callback);
    }
  }

  _emit(event, data) {
    this._callbacks[event].forEach(cb => cb(data));
  }

  _getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.cw / rect.width;
    const scaleY = this.ch / rect.height;
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    };
  }

  _bindEvents() {
    const onStart = (e) => {
      if (e.touches) e.preventDefault();
      const pos = this._getPos(e);
      this.isDragging = true;
      this.dragStart = { ...pos };
      this.dragCurrent = { ...pos };
      this._emit('drag_start', { x: pos.x, y: pos.y });
    };

    const onMove = (e) => {
      if (!this.isDragging) return;
      if (e.touches) e.preventDefault();
      const pos = this._getPos(e);
      this.dragCurrent = { ...pos };
      this._emit('drag_move', {
        x: pos.x,
        y: pos.y,
        dx: pos.x - this.dragStart.x,
        dy: pos.y - this.dragStart.y,
        startX: this.dragStart.x,
        startY: this.dragStart.y,
      });
    };

    const onEnd = (e) => {
      if (!this.isDragging) return;
      if (e.touches) e.preventDefault();
      this.isDragging = false;

      const dx = this.dragCurrent.x - this.dragStart.x;
      const dy = this.dragCurrent.y - this.dragStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 10) {
        this._emit('tap', { x: this.dragStart.x, y: this.dragStart.y });
      }

      this._emit('drag_end', {
        x: this.dragCurrent.x,
        y: this.dragCurrent.y,
        dx, dy,
        startX: this.dragStart.x,
        startY: this.dragStart.y,
        distance: dist,
        power: Math.min(dist / 150, 1),
      });
    };

    this.canvas.addEventListener('touchstart', onStart, { passive: false });
    this.canvas.addEventListener('touchmove', onMove, { passive: false });
    this.canvas.addEventListener('touchend', onEnd, { passive: false });
    this.canvas.addEventListener('mousedown', onStart);
    this.canvas.addEventListener('mousemove', onMove);
    this.canvas.addEventListener('mouseup', onEnd);
    window.addEventListener('mouseup', onEnd);
  }
}

// ============================================================
// BACKGROUND RENDERER
// ============================================================
class Background {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.stars = [];
    for (let i = 0; i < 50; i++) {
      this.stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.3 + 0.1,
      });
    }
  }

  draw(ctx, time) {
    // Gradient bg
    const grad = ctx.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, THEME.bgGrad1);
    grad.addColorStop(1, THEME.bgGrad2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);

    // Stars
    this.stars.forEach(s => {
      const brightness = 0.2 + Math.sin(time * s.speed * 5 + s.x) * 0.3;
      ctx.globalAlpha = brightness;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// UI RENDERER
// ============================================================
class UI {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.scoreDisplay = 0; // animated score
    this.comboDisplay = 0;
    this.bestScore = parseInt(localStorage.getItem('arcade_best') || '0');
    this._buttons = [];
  }

  updateScore(targetScore, dt) {
    if (this.scoreDisplay < targetScore) {
      this.scoreDisplay += Math.max(1, (targetScore - this.scoreDisplay) * dt * 10);
      if (this.scoreDisplay > targetScore) this.scoreDisplay = targetScore;
    }
  }

  saveBest(score) {
    if (score > this.bestScore) {
      this.bestScore = score;
      localStorage.setItem('arcade_best', String(score));
      return true; // new best!
    }
    return false;
  }

  drawScore(ctx, score, combo, time) {
    // Score
    ctx.fillStyle = THEME.textWhite;
    ctx.shadowColor = THEME.primary;
    ctx.shadowBlur = 20;
    ctx.font = "bold 56px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(Math.floor(this.scoreDisplay), this.w / 2, this.h - 55);
    ctx.shadowBlur = 0;

    // Combo
    if (combo > 1) {
      const pulse = 1 + Math.sin(time * 6) * 0.08;
      ctx.fillStyle = THEME.highlight;
      ctx.shadowColor = THEME.highlight;
      ctx.shadowBlur = 12;
      ctx.font = `bold ${20 * pulse}px 'Arial Black', Impact, sans-serif`;
      ctx.fillText(`COMBO x${combo}`, this.w / 2, this.h - 22);
      ctx.shadowBlur = 0;
    }
  }

  drawMenuScreen(ctx, gameName, time) {
    // Darken
    ctx.fillStyle = 'rgba(10, 10, 26, 0.6)';
    ctx.fillRect(0, 0, this.w, this.h);

    // Title
    const titleY = this.h * 0.3;
    const scale = 1 + Math.sin(time * 2) * 0.03;
    ctx.save();
    ctx.translate(this.w / 2, titleY);
    ctx.scale(scale, scale);
    ctx.fillStyle = THEME.textWhite;
    ctx.shadowColor = THEME.primary;
    ctx.shadowBlur = 30;
    ctx.font = "bold 52px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(gameName, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Best score
    if (this.bestScore > 0) {
      ctx.fillStyle = THEME.highlight;
      ctx.font = "bold 18px 'Arial Black', Impact, sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(`BEST: ${this.bestScore}`, this.w / 2, titleY + 45);
    }

    // Tap to play
    const alpha = 0.4 + Math.sin(time * 3) * 0.4;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = THEME.textWhite;
    ctx.font = "600 18px Arial, sans-serif";
    ctx.fillText('TAP TO PLAY', this.w / 2, this.h * 0.65);
    ctx.globalAlpha = 1;
  }

  drawGameOverScreen(ctx, score, bestScore, isNewBest, time) {
    // Darken
    ctx.fillStyle = 'rgba(10, 10, 26, 0.8)';
    ctx.fillRect(0, 0, this.w, this.h);

    const centerY = this.h * 0.35;

    // Game Over text
    ctx.fillStyle = THEME.fail;
    ctx.shadowColor = THEME.fail;
    ctx.shadowBlur = 20;
    ctx.font = "bold 42px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', this.w / 2, centerY);
    ctx.shadowBlur = 0;

    // Score
    ctx.fillStyle = THEME.textWhite;
    ctx.font = "bold 64px 'Arial Black', Impact, sans-serif";
    ctx.fillText(score, this.w / 2, centerY + 70);

    // New best badge
    if (isNewBest) {
      const pulse = 1 + Math.sin(time * 5) * 0.1;
      ctx.fillStyle = THEME.highlight;
      ctx.shadowColor = THEME.highlight;
      ctx.shadowBlur = 15;
      ctx.font = `bold ${18 * pulse}px 'Arial Black', Impact, sans-serif`;
      ctx.fillText('★ NEW BEST! ★', this.w / 2, centerY + 105);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = THEME.textDim;
      ctx.font = "bold 16px Arial, sans-serif";
      ctx.fillText(`BEST: ${bestScore}`, this.w / 2, centerY + 105);
    }

    // Buttons
    this._buttons = [];

    // Retry button
    const btnY = centerY + 160;
    const btnW = 200, btnH = 50, btnR = 25;
    this._drawButton(ctx, this.w / 2, btnY, btnW, btnH, btnR, 'PLAY AGAIN', THEME.primary, time);
    this._buttons.push({ x: this.w / 2, y: btnY, w: btnW, h: btnH, action: 'retry' });

    // Share button
    const shareBtnY = btnY + 70;
    this._drawButton(ctx, this.w / 2, shareBtnY, btnW, btnH, btnR, 'SHARE SCORE', THEME.accentDark, time);
    this._buttons.push({ x: this.w / 2, y: shareBtnY, w: btnW, h: btnH, action: 'share' });

    // Tap hint
    const alpha = 0.3 + Math.sin(time * 3) * 0.2;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = THEME.textDim;
    ctx.font = "400 13px Arial, sans-serif";
    ctx.fillText('or tap anywhere to retry', this.w / 2, shareBtnY + 55);
    ctx.globalAlpha = 1;
  }

  _drawButton(ctx, cx, cy, w, h, r, text, color, time) {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(cx - w/2 + r, cy - h/2);
    ctx.lineTo(cx + w/2 - r, cy - h/2);
    ctx.quadraticCurveTo(cx + w/2, cy - h/2, cx + w/2, cy - h/2 + r);
    ctx.lineTo(cx + w/2, cy + h/2 - r);
    ctx.quadraticCurveTo(cx + w/2, cy + h/2, cx + w/2 - r, cy + h/2);
    ctx.lineTo(cx - w/2 + r, cy + h/2);
    ctx.quadraticCurveTo(cx - w/2, cy + h/2, cx - w/2, cy + h/2 - r);
    ctx.lineTo(cx - w/2, cy - h/2 + r);
    ctx.quadraticCurveTo(cx - w/2, cy - h/2, cx - w/2 + r, cy - h/2);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = THEME.textWhite;
    ctx.font = "bold 18px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(text, cx, cy + 6);
  }

  hitTestButtons(x, y) {
    for (const btn of this._buttons) {
      if (x > btn.x - btn.w/2 && x < btn.x + btn.w/2 &&
          y > btn.y - btn.h/2 && y < btn.y + btn.h/2) {
        return btn.action;
      }
    }
    return null;
  }

  shareScore(gameName, score) {
    const text = `I scored ${score} in ${gameName}! Can you beat that? 🔥`;
    if (navigator.share) {
      navigator.share({ title: gameName, text });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  }
}

// ============================================================
// DRAW UTILITIES
// ============================================================
function drawGlow(ctx, x, y, radius, color) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, color + '40');
  grad.addColorStop(0.5, color + '15');
  grad.addColorStop(1, color + '00');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function lerpColor(a, b, t) {
  const ah = parseInt(a.replace('#', ''), 16);
  const bh = parseInt(b.replace('#', ''), 16);
  const ar = ah >> 16, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = bh >> 16, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `rgb(${rr},${rg},${rb})`;
}

// ============================================================
// MAIN ENGINE
// ============================================================
class ArcadeEngine {
  constructor(canvasId, config = {}) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.config = config;

    // Canvas sizing
    this.W = config.width || 400;
    this.H = config.height || 700;
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this._resize();
    window.addEventListener('resize', () => this._resize());

    // Systems
    this.particles = new ParticleSystem();
    this.juice = new Juice();
    this.sound = new SoundManager();
    this.tweens = new TweenManager();
    this.floatingText = new FloatingTextManager();
    this.input = new InputHandler(this.canvas, this.W, this.H);
    this.bg = new Background(this.W, this.H);
    this.ui = new UI(this.W, this.H);

    // Game state
    this.state = 'menu'; // 'menu', 'playing', 'gameover'
    this.score = 0;
    this.combo = 0;
    this.time = 0;
    this.gameName = config.name || 'ARCADE';

    // Storage key for this specific game
    this._storageKey = 'arcade_best_' + this.gameName.toLowerCase().replace(/\s/g, '_');
    this.ui.bestScore = parseInt(localStorage.getItem(this._storageKey) || '0');

    // Delta time
    this._lastTime = 0;
    this._running = false;

    // Bind input
    this.input.on('tap', (data) => this._onTap(data));
    this.input.on('drag_start', (data) => this._onInput('drag_start', data));
    this.input.on('drag_move', (data) => this._onInput('drag_move', data));
    this.input.on('drag_end', (data) => this._onInput('drag_end', data));
  }

  _resize() {
    const scale = Math.min(window.innerWidth / this.W, window.innerHeight / this.H, 1);
    this.canvas.style.width = this.W * scale + 'px';
    this.canvas.style.height = this.H * scale + 'px';
  }

  start() {
    this._running = true;
    requestAnimationFrame((t) => this._loop(t));
  }

  setState(newState) {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'playing') {
      this.score = 0;
      this.combo = 0;
      this.ui.scoreDisplay = 0;
      this.particles.clear();
      this.floatingText.clear();
      this.tweens.clear();
    }

    if (newState === 'gameover') {
      this._isNewBest = this.ui.saveBest(this.score);
      localStorage.setItem(this._storageKey, String(this.ui.bestScore));
      this.sound.gameOver();
      if (this._isNewBest) {
        setTimeout(() => this.sound.newBest(), 400);
        this.juice.flash(THEME.highlight, 0.2);
      }
    }

    if (this.config.onStateChange) {
      this.config.onStateChange(newState, oldState);
    }
  }

  addScore(amount = 1) {
    this.score += amount;
    this.combo++;
    if (this.combo > 2) {
      this.sound.combo(this.combo);
    } else {
      this.sound.score();
    }
  }

  resetCombo() {
    this.combo = 0;
  }

  _onTap(data) {
    this.sound.init(); // init audio on first user interaction

    if (this.state === 'menu') {
      this.setState('playing');
      if (this.config.onInput) this.config.onInput('tap', data, this);
      return;
    }

    if (this.state === 'gameover') {
      const action = this.ui.hitTestButtons(data.x, data.y);
      if (action === 'share') {
        this.ui.shareScore(this.gameName, this.score);
        return;
      }
      this.setState('playing');
      if (this.config.onStateChange) this.config.onStateChange('playing', 'gameover');
      return;
    }

    if (this.config.onInput) this.config.onInput('tap', data, this);
  }

  _onInput(type, data) {
    this.sound.init();
    if (this.state === 'playing' && this.config.onInput) {
      this.config.onInput(type, data, this);
    }
  }

  _loop(timestamp) {
    if (!this._running) return;

    const rawDt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
    this._lastTime = timestamp;
    const dt = rawDt * this.juice.getTimeScale();
    this.time += dt;

    // Update systems
    this.juice.update(rawDt);
    this.tweens.update(dt);
    this.particles.update(dt);
    this.floatingText.update(dt);
    this.ui.updateScore(this.score, dt);

    // Update game
    if (this.state === 'playing' && this.config.onUpdate) {
      this.config.onUpdate(dt, this);
    }

    // Draw
    const ctx = this.ctx;
    ctx.save();
    this.juice.applyShake(ctx);

    // Background
    this.bg.draw(ctx, this.time);

    // Game draw
    if (this.config.onDraw) {
      this.config.onDraw(ctx, this);
    }

    // Particles & floating text
    this.particles.draw(ctx);
    this.floatingText.draw(ctx);

    // UI
    if (this.state === 'playing') {
      this.ui.drawScore(ctx, this.score, this.combo, this.time);
    }

    // Flash overlay
    this.juice.drawFlash(ctx, this.W, this.H);

    // Menu/Game over overlay
    if (this.state === 'menu') {
      this.ui.drawMenuScreen(ctx, this.gameName, this.time);
    } else if (this.state === 'gameover') {
      this.ui.drawGameOverScreen(ctx, this.score, this.ui.bestScore, this._isNewBest, this.time);
    }

    ctx.restore();

    requestAnimationFrame((t) => this._loop(t));
  }
}

// Export for use
if (typeof module !== 'undefined') module.exports = { ArcadeEngine, THEME, Ease, drawGlow, drawRoundedRect, lerpColor };
