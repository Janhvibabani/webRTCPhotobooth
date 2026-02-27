/**
 * canvas.js — Photobooth Canvas Compositor
 *
 * Composites:
 *   1. Themed background  (gradient / scene)
 *   2. Merged masks       (OR combination of remote + local segmentation)
 *   3. Decorative frame   (drawn on top)
 *   4. Text overlays      (date stamp, etc.)
 *
 * Layout: Full canvas usage
 * - Both people rendered on full canvas with backgrounds removed
 * - Local mask ORed with remote mask (lighten blend mode)
 * - Where masks overlap = both visible
 * - Natural composition that follows camera movement
 */

// ─── Themes ──────────────────────────────────────────────────────────────────
const THEMES = [
  {
    id: 'neon',
    label: 'Neon City',
    icon: '🌆',
    draw(ctx, w, h) {
      // Deep night sky gradient
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0,   '#0a0015');
      g.addColorStop(0.5, '#10003a');
      g.addColorStop(1,   '#200050');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // City silhouette
      ctx.fillStyle = '#05000f';
      // Buildings
      const buildings = [
        [0, h*0.55, 60, h*0.45],
        [55, h*0.45, 40, h*0.55],
        [90, h*0.5, 80, h*0.5],
        [165, h*0.38, 50, h*0.62],
        [210, h*0.52, 70, h*0.48],
        [275, h*0.42, 55, h*0.58],
        [325, h*0.35, 45, h*0.65],
        [w-280, h*0.44, 60, h*0.56],
        [w-225, h*0.38, 50, h*0.62],
        [w-180, h*0.5, 75, h*0.5],
        [w-110, h*0.42, 55, h*0.58],
        [w-60,  h*0.5, 65, h*0.5],
      ];
      buildings.forEach(([x, y, bw, bh]) => ctx.fillRect(x, y, bw, bh));

      // Neon glow dots (windows)
      const neonColors = ['#ff2dd4','#00e5ff','#aaff00','#ff6600','#7b00ff'];
      ctx.save();
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * w;
        const y = h * 0.35 + Math.random() * h * 0.5;
        const r = 1 + Math.random() * 2;
        const c = neonColors[Math.floor(Math.random() * neonColors.length)];
        ctx.shadowBlur  = 8;
        ctx.shadowColor = c;
        ctx.fillStyle   = c;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Ground glow
      const groundG = ctx.createLinearGradient(0, h*0.8, 0, h);
      groundG.addColorStop(0, 'rgba(120,0,200,0)');
      groundG.addColorStop(1, 'rgba(120,0,200,0.3)');
      ctx.fillStyle = groundG;
      ctx.fillRect(0, h*0.8, w, h*0.2);
    }
  },
  {
    id: 'sunset',
    label: 'Sunset',
    icon: '🌅',
    draw(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0,   '#1a0533');
      g.addColorStop(0.3, '#d4275a');
      g.addColorStop(0.55,'#f5872a');
      g.addColorStop(0.75,'#fdd06a');
      g.addColorStop(1,   '#e84c1e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Sun
      ctx.save();
      ctx.beginPath();
      ctx.arc(w/2, h * 0.62, h * 0.14, 0, Math.PI * 2);
      ctx.fillStyle = '#fffde0';
      ctx.shadowBlur  = 60;
      ctx.shadowColor = '#ffe080';
      ctx.fill();
      ctx.restore();

      // Horizon reflection
      const reflG = ctx.createLinearGradient(0, h*0.65, 0, h);
      reflG.addColorStop(0, 'rgba(255,200,60,0.3)');
      reflG.addColorStop(1, 'rgba(200,40,20,0.1)');
      ctx.fillStyle = reflG;
      ctx.fillRect(0, h*0.65, w, h*0.35);

      // Horizon line
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, h*0.65, w, 2);
    }
  },
  {
    id: 'forest',
    label: 'Forest',
    icon: '🌿',
    draw(ctx, w, h) {
      // Sky
      const g = ctx.createLinearGradient(0, 0, 0, h*0.5);
      g.addColorStop(0, '#0a1f0f');
      g.addColorStop(1, '#153320');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Ground
      const gg = ctx.createLinearGradient(0, h*0.7, 0, h);
      gg.addColorStop(0, '#0d2a12');
      gg.addColorStop(1, '#050f07');
      ctx.fillStyle = gg;
      ctx.fillRect(0, h*0.7, w, h*0.3);

      // Trees (simple silhouettes)
      ctx.fillStyle = '#050f07';
      const drawTree = (x, baseY, trunkH, trunkW, coneH, coneW) => {
        ctx.fillRect(x - trunkW/2, baseY - trunkH, trunkW, trunkH);
        ctx.beginPath();
        ctx.moveTo(x, baseY - trunkH - coneH);
        ctx.lineTo(x - coneW/2, baseY - trunkH + 10);
        ctx.lineTo(x + coneW/2, baseY - trunkH + 10);
        ctx.closePath();
        ctx.fill();
        // Second tier
        ctx.beginPath();
        ctx.moveTo(x, baseY - trunkH - coneH * 1.5);
        ctx.lineTo(x - coneW*0.7/2, baseY - trunkH - coneH * 0.4);
        ctx.lineTo(x + coneW*0.7/2, baseY - trunkH - coneH * 0.4);
        ctx.closePath();
        ctx.fill();
      };

      drawTree(30,  h*0.7, 80, 14, 120, 70);
      drawTree(120, h*0.7, 100, 16, 150, 90);
      drawTree(w-30, h*0.7, 80, 14, 120, 70);
      drawTree(w-120, h*0.7, 100, 16, 150, 90);
      drawTree(0, h*0.7, 60, 12, 100, 60);
      drawTree(w, h*0.7, 60, 12, 100, 60);

      // Fireflies
      ctx.save();
      for (let i = 0; i < 25; i++) {
        const x = 40 + Math.random() * (w - 80);
        const y = h * 0.2 + Math.random() * h * 0.5;
        ctx.shadowBlur  = 10;
        ctx.shadowColor = '#aaff88';
        ctx.fillStyle   = 'rgba(180,255,120,0.7)';
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  },
  {
    id: 'studio',
    label: 'Studio',
    icon: '⬜',
    draw(ctx, w, h) {
      // Clean gradient studio look
      const g = ctx.createRadialGradient(w/2, h*0.4, 0, w/2, h*0.4, w*0.7);
      g.addColorStop(0,   '#f8f4ee');
      g.addColorStop(0.6, '#e8e0d4');
      g.addColorStop(1,   '#c8bfb0');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Floor line
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, h*0.7, w, h*0.3);

      // Vignette
      const vig = ctx.createRadialGradient(w/2, h/2, h*0.3, w/2, h/2, w*0.8);
      vig.addColorStop(0, 'transparent');
      vig.addColorStop(1, 'rgba(100,80,60,0.3)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'space',
    label: 'Outer Space',
    icon: '🚀',
    draw(ctx, w, h) {
      ctx.fillStyle = '#02020f';
      ctx.fillRect(0, 0, w, h);

      // Stars
      ctx.save();
      for (let i = 0; i < 200; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = Math.random() * 1.5;
        const alpha = 0.3 + Math.random() * 0.7;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Nebula blob
      const neb = ctx.createRadialGradient(w*0.7, h*0.3, 0, w*0.7, h*0.3, w*0.4);
      neb.addColorStop(0,   'rgba(80,0,160,0.4)');
      neb.addColorStop(0.5, 'rgba(0,80,160,0.2)');
      neb.addColorStop(1,   'transparent');
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, w, h);

      const neb2 = ctx.createRadialGradient(w*0.2, h*0.7, 0, w*0.2, h*0.7, w*0.3);
      neb2.addColorStop(0,   'rgba(160,0,80,0.3)');
      neb2.addColorStop(1,   'transparent');
      ctx.fillStyle = neb2;
      ctx.fillRect(0, 0, w, h);

      // Planet
      ctx.save();
      ctx.beginPath();
      ctx.arc(w*0.85, h*0.15, 55, 0, Math.PI * 2);
      const planetG = ctx.createRadialGradient(w*0.85-15, h*0.15-15, 5, w*0.85, h*0.15, 55);
      planetG.addColorStop(0, '#c0a0ff');
      planetG.addColorStop(1, '#4400cc');
      ctx.fillStyle = planetG;
      ctx.fill();
      // Ring
      ctx.strokeStyle = 'rgba(200,180,255,0.5)';
      ctx.lineWidth   = 6;
      ctx.beginPath();
      ctx.ellipse(w*0.85, h*0.15, 80, 16, -0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  },
  {
    id: 'confetti',
    label: 'Party!',
    icon: '🎉',
    draw(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#1a0a2e');
      g.addColorStop(1, '#0a1a2e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Confetti
      const colors = ['#ff2d55','#f5c842','#5ecb7a','#00c8ff','#c066ff','#ff9500'];
      ctx.save();
      for (let i = 0; i < 120; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const sw = 4 + Math.random() * 8;
        const sh = 2 + Math.random() * 4;
        const rot = Math.random() * Math.PI;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.globalAlpha = 0.6 + Math.random() * 0.4;
        ctx.fillRect(-sw/2, -sh/2, sw, sh);
        ctx.restore();
      }
      ctx.restore();
    }
  }
];

// ─── Frames ───────────────────────────────────────────────────────────────────
const FRAMES = [
  {
    id: 'none',
    label: 'None',
    icon: '○',
    draw(ctx, w, h) {}
  },
  {
    id: 'classic',
    label: 'Classic',
    icon: '🟫',
    draw(ctx, w, h) {
      const bw = 18;
      // Outer border
      ctx.strokeStyle = '#c8a060';
      ctx.lineWidth   = bw;
      ctx.strokeRect(bw/2, bw/2, w - bw, h - bw);
      // Inner thin line
      ctx.strokeStyle = '#8a5a20';
      ctx.lineWidth   = 2;
      ctx.strokeRect(bw + 6, bw + 6, w - bw*2 - 12, h - bw*2 - 12);
      // Corner ornaments
      const drawCorner = (cx, cy, dx, dy) => {
        ctx.strokeStyle = '#c8a060';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx + dx * 8, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + dy * 8);
        ctx.stroke();
      };
      const m = bw + 10;
      drawCorner(m, m, 1, 1);
      drawCorner(w-m, m, -1, 1);
      drawCorner(m, h-m, 1, -1);
      drawCorner(w-m, h-m, -1, -1);
    }
  },
  {
    id: 'polaroid',
    label: 'Polaroid',
    icon: '📷',
    draw(ctx, w, h) {
      // Top/side white border
      const top = 20, side = 20, bottom = 70;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillRect(0, 0, w, top);           // top
      ctx.fillRect(0, 0, side, h);          // left
      ctx.fillRect(w-side, 0, side, h);     // right
      ctx.fillRect(0, h-bottom, w, bottom); // bottom

      // Signature line on bottom
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(side + 20, h - bottom + 40);
      ctx.lineTo(w - side - 20, h - bottom + 40);
      ctx.stroke();

      // Subtle drop shadow on edges
      const sh = ctx.createLinearGradient(side, 0, side + 10, 0);
      sh.addColorStop(0, 'rgba(0,0,0,0.15)');
      sh.addColorStop(1, 'transparent');
      ctx.fillStyle = sh;
      ctx.fillRect(side, top, 12, h - top - bottom);
    }
  },
  {
    id: 'neon-border',
    label: 'Neon',
    icon: '💜',
    draw(ctx, w, h) {
      const bw = 6;
      // Animated neon glow
      const colors = ['#ff00ff', '#00ffff'];
      colors.forEach((c, i) => {
        ctx.save();
        ctx.shadowBlur  = 20 + i * 10;
        ctx.shadowColor = c;
        ctx.strokeStyle = c;
        ctx.lineWidth   = bw;
        const off = bw/2 + i * 8;
        ctx.strokeRect(off, off, w - off*2, h - off*2);
        ctx.restore();
      });

      // Corner flash
      ctx.save();
      ctx.fillStyle   = '#ffffff';
      ctx.shadowBlur  = 20;
      ctx.shadowColor = '#ffffff';
      const cs = 20;
      [[0,0],[w,0],[0,h],[w,h]].forEach(([cx, cy]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, cs, 0, Math.PI*2);
        ctx.fill();
      });
      ctx.restore();
    }
  },
  {
    id: 'hearts',
    label: 'Love',
    icon: '💕',
    draw(ctx, w, h) {
      // Gentle pink vignette
      const vig = ctx.createRadialGradient(w/2, h/2, h*0.25, w/2, h/2, w*0.6);
      vig.addColorStop(0,   'transparent');
      vig.addColorStop(0.8, 'transparent');
      vig.addColorStop(1,   'rgba(255,100,150,0.4)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      // Scatter hearts
      const drawHeart = (x, y, size, alpha) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = '#ff6090';
        ctx.beginPath();
        ctx.moveTo(x, y + size * 0.3);
        ctx.bezierCurveTo(x, y, x - size, y, x - size, y + size * 0.3);
        ctx.bezierCurveTo(x - size, y + size * 0.65, x, y + size, x, y + size * 1.2);
        ctx.bezierCurveTo(x, y + size, x + size, y + size * 0.65, x + size, y + size * 0.3);
        ctx.bezierCurveTo(x + size, y, x, y, x, y + size * 0.3);
        ctx.fill();
        ctx.restore();
      };

      // Border hearts
      for (let i = 0; i < 12; i++) {
        drawHeart(30 + Math.random() * 40, i * (h/12) + 10, 6 + Math.random() * 6, 0.3 + Math.random() * 0.5);
        drawHeart(w - 70 + Math.random() * 40, i * (h/12) + 10, 6 + Math.random() * 6, 0.3 + Math.random() * 0.5);
      }
    }
  }
];

// ─── Compositor ───────────────────────────────────────────────────────────────
class PhotoboothCompositor {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx    = canvasEl.getContext('2d');

    // Config
    this.W = 900;
    this.H = 540;
    this.canvas.width  = this.W;
    this.canvas.height = this.H;

    this.themeIdx = 0;
    this.frameIdx = 0;

    // Latest segmented person frames (from segmentation pipelines)
    this.localMask  = null;
    this.remoteMask = null;

    // Combined mask canvas (OR of both masks)
    this.combinedMask = document.createElement('canvas');
    this.combinedMask.width = this.W;
    this.combinedMask.height = this.H;

    // State
    this.running    = false;
    this.peerReady  = false;
    this._raf       = null;

    // Seed static confetti so it's consistent each frame
    this._seedRandom();
  }

  _seedRandom() {
    // Pre-generate random data for backgrounds that use random (so they don't flicker)
    this._rdata = Array.from({ length: 300 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random(), a: Math.random(),
      rot: Math.random(), sw: Math.random(), sh: Math.random()
    }));
  }

  setTheme(idx) { this.themeIdx = idx; }
  setFrame(idx) { this.frameIdx = idx; }

  updateLocalMask(canvas)  { this.localMask  = canvas; }
  updateRemoteMask(canvas) { this.remoteMask = canvas; }

  start() {
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  _loop() {
    if (!this.running) return;
    this._draw();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _drawMaskScaled(maskCanvas, isLocal) {
    const { ctx, W, H } = this;
    
    const srcW = maskCanvas.width;
    const srcH = maskCanvas.height;
    if (srcW === 0 || srcH === 0) {
      console.warn(`[Canvas] ${isLocal ? 'Local' : 'Remote'} mask has 0 dimensions`);
      return;
    }

    // Scale to fill canvas (cover mode)
    const scale = Math.max(W / srcW, H / srcH);
    const dw = srcW * scale;
    const dh = srcH * scale;

    // Center on canvas
    let dx = (W - dw) / 2;
    let dy = (H - dh) / 2;

    ctx.save();

    if (isLocal) {
      // Mirror local video (selfie effect)
      ctx.translate(W / 2, 0);
      ctx.scale(-1, 1);
      dx = -W / 2 + dx;
    }

    ctx.drawImage(maskCanvas, dx, dy, dw, dh);
    ctx.restore();
  }

  _draw() {
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H);

    // 1. Background theme
    this._drawTheme();

    // 2. Draw both masks on full canvas with lighten blend (OR effect)
    if (this.remoteMask) {
      this._drawMaskScaled(this.remoteMask, false);
    }

    if (this.localMask) {
      // Use lighten blend so both are visible where they overlap
      ctx.globalCompositeOperation = 'lighten';
      this._drawMaskScaled(this.localMask, true);
      ctx.globalCompositeOperation = 'source-over';
    }

    // 3. Frame overlay
    FRAMES[this.frameIdx].draw(ctx, W, H);

    // 4. Date stamp
    this._drawDateStamp();
  }

  _drawTheme() {
    // Use seeded random to prevent flickering on themes with random elements
    const savedRandom = Math.random;
    let idx = 0;
    Math.random = () => {
      const v = this._rdata[idx % this._rdata.length];
      idx++;
      return v.x; // cycle through x values
    };
    THEMES[this.themeIdx].draw(this.ctx, this.W, this.H);
    Math.random = savedRandom;
  }

  _drawDateStamp() {
    const { ctx, W, H } = this;
    const now  = new Date();
    const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    ctx.save();
    ctx.font         = '12px "Space Mono", monospace';
    ctx.fillStyle    = 'rgba(255,255,255,0.5)';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(date, W - 14, H - 10);
    ctx.restore();
  }

  snapshot() {
    return this.canvas.toDataURL('image/jpeg', 0.92);
  }
}

// Export globals
window.THEMES = THEMES;
window.FRAMES = FRAMES;
window.PhotoboothCompositor = PhotoboothCompositor;