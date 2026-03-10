/**
 * canvas.js — Photobooth Canvas Compositor
 *
 * Slot-based layout (assigned by server on join):
 *   slot 0 (first to join)  → LEFT  half
 *   slot 1 (second to join) → RIGHT half
 *
 * Each client knows their own slot. "local" always goes into mySlot's region.
 * "remote" goes into the other slot's region.
 *
 * When only one person is present they fill the full canvas.
 */

// ─── Themes ──────────────────────────────────────────────────────────────────
const THEMES = [
  {
    id: 'neon', label: 'Neon City', icon: '🌆',
    draw(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0a0015'); g.addColorStop(0.5, '#10003a'); g.addColorStop(1, '#200050');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#05000f';
      const buildings = [
        [0,h*.55,60,h*.45],[55,h*.45,40,h*.55],[90,h*.5,80,h*.5],[165,h*.38,50,h*.62],
        [210,h*.52,70,h*.48],[275,h*.42,55,h*.58],[325,h*.35,45,h*.65],
        [w-280,h*.44,60,h*.56],[w-225,h*.38,50,h*.62],[w-180,h*.5,75,h*.5],
        [w-110,h*.42,55,h*.58],[w-60,h*.5,65,h*.5],
      ];
      buildings.forEach(([x,y,bw,bh]) => ctx.fillRect(x,y,bw,bh));

      const neonColors = ['#ff2dd4','#00e5ff','#aaff00','#ff6600','#7b00ff'];
      ctx.save();
      for (let i = 0; i < 80; i++) {
        const x = Math.random()*w, y = h*.35+Math.random()*h*.5;
        const r = 1+Math.random()*2, c = neonColors[Math.floor(Math.random()*neonColors.length)];
        ctx.shadowBlur=8; ctx.shadowColor=c; ctx.fillStyle=c;
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();

      const gg = ctx.createLinearGradient(0,h*.8,0,h);
      gg.addColorStop(0,'rgba(120,0,200,0)'); gg.addColorStop(1,'rgba(120,0,200,0.3)');
      ctx.fillStyle=gg; ctx.fillRect(0,h*.8,w,h*.2);
    }
  },
  {
    id: 'sunset', label: 'Sunset', icon: '🌅',
    draw(ctx, w, h) {
      const g = ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#1a0533'); g.addColorStop(.3,'#d4275a');
      g.addColorStop(.55,'#f5872a'); g.addColorStop(.75,'#fdd06a'); g.addColorStop(1,'#e84c1e');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      ctx.save();
      ctx.beginPath(); ctx.arc(w/2,h*.62,h*.14,0,Math.PI*2);
      ctx.fillStyle='#fffde0'; ctx.shadowBlur=60; ctx.shadowColor='#ffe080'; ctx.fill();
      ctx.restore();
      const rg = ctx.createLinearGradient(0,h*.65,0,h);
      rg.addColorStop(0,'rgba(255,200,60,.3)'); rg.addColorStop(1,'rgba(200,40,20,.1)');
      ctx.fillStyle=rg; ctx.fillRect(0,h*.65,w,h*.35);
      ctx.fillStyle='rgba(0,0,0,.15)'; ctx.fillRect(0,h*.65,w,2);
    }
  },
  {
    id: 'forest', label: 'Forest', icon: '🌿',
    draw(ctx, w, h) {
      const g = ctx.createLinearGradient(0,0,0,h*.5);
      g.addColorStop(0,'#0a1f0f'); g.addColorStop(1,'#153320');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      const gg = ctx.createLinearGradient(0,h*.7,0,h);
      gg.addColorStop(0,'#0d2a12'); gg.addColorStop(1,'#050f07');
      ctx.fillStyle=gg; ctx.fillRect(0,h*.7,w,h*.3);
      ctx.fillStyle='#050f07';
      const t = (x,by,th,tw,ch,cw) => {
        ctx.fillRect(x-tw/2,by-th,tw,th);
        ctx.beginPath(); ctx.moveTo(x,by-th-ch); ctx.lineTo(x-cw/2,by-th+10); ctx.lineTo(x+cw/2,by-th+10); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x,by-th-ch*1.5); ctx.lineTo(x-cw*.35,by-th-ch*.4); ctx.lineTo(x+cw*.35,by-th-ch*.4); ctx.closePath(); ctx.fill();
      };
      t(30,h*.7,80,14,120,70); t(120,h*.7,100,16,150,90);
      t(w-30,h*.7,80,14,120,70); t(w-120,h*.7,100,16,150,90);
      ctx.save();
      for (let i=0;i<25;i++) {
        const x=40+Math.random()*(w-80), y=h*.2+Math.random()*h*.5;
        ctx.shadowBlur=10; ctx.shadowColor='#aaff88'; ctx.fillStyle='rgba(180,255,120,.7)';
        ctx.beginPath(); ctx.arc(x,y,1.5,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
  },
  {
    id: 'studio', label: 'Studio', icon: '⬜',
    draw(ctx, w, h) {
      const g = ctx.createRadialGradient(w/2,h*.4,0,w/2,h*.4,w*.7);
      g.addColorStop(0,'#f8f4ee'); g.addColorStop(.6,'#e8e0d4'); g.addColorStop(1,'#c8bfb0');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      ctx.fillStyle='rgba(0,0,0,.06)'; ctx.fillRect(0,h*.7,w,h*.3);
      const v = ctx.createRadialGradient(w/2,h/2,h*.3,w/2,h/2,w*.8);
      v.addColorStop(0,'transparent'); v.addColorStop(1,'rgba(100,80,60,.3)');
      ctx.fillStyle=v; ctx.fillRect(0,0,w,h);
    }
  },
  {
    id: 'space', label: 'Outer Space', icon: '🚀',
    draw(ctx, w, h) {
      ctx.fillStyle='#02020f'; ctx.fillRect(0,0,w,h);
      ctx.save();
      for (let i=0;i<200;i++) {
        const x=Math.random()*w,y=Math.random()*h,r=Math.random()*1.5,a=.3+Math.random()*.7;
        ctx.fillStyle=`rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      const n1=ctx.createRadialGradient(w*.7,h*.3,0,w*.7,h*.3,w*.4);
      n1.addColorStop(0,'rgba(80,0,160,.4)'); n1.addColorStop(.5,'rgba(0,80,160,.2)'); n1.addColorStop(1,'transparent');
      ctx.fillStyle=n1; ctx.fillRect(0,0,w,h);
      const n2=ctx.createRadialGradient(w*.2,h*.7,0,w*.2,h*.7,w*.3);
      n2.addColorStop(0,'rgba(160,0,80,.3)'); n2.addColorStop(1,'transparent');
      ctx.fillStyle=n2; ctx.fillRect(0,0,w,h);
      ctx.save();
      ctx.beginPath(); ctx.arc(w*.85,h*.15,55,0,Math.PI*2);
      const pg=ctx.createRadialGradient(w*.85-15,h*.15-15,5,w*.85,h*.15,55);
      pg.addColorStop(0,'#c0a0ff'); pg.addColorStop(1,'#4400cc');
      ctx.fillStyle=pg; ctx.fill();
      ctx.strokeStyle='rgba(200,180,255,.5)'; ctx.lineWidth=6;
      ctx.beginPath(); ctx.ellipse(w*.85,h*.15,80,16,-.3,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }
  },
  {
    id: 'confetti', label: 'Party!', icon: '🎉',
    draw(ctx, w, h) {
      const g=ctx.createLinearGradient(0,0,w,h);
      g.addColorStop(0,'#1a0a2e'); g.addColorStop(1,'#0a1a2e');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      const colors=['#ff2d55','#f5c842','#5ecb7a','#00c8ff','#c066ff','#ff9500'];
      ctx.save();
      for (let i=0;i<120;i++) {
        const x=Math.random()*w,y=Math.random()*h,sw=4+Math.random()*8,sh=2+Math.random()*4,rot=Math.random()*Math.PI;
        ctx.save(); ctx.translate(x,y); ctx.rotate(rot);
        ctx.fillStyle=colors[Math.floor(Math.random()*colors.length)];
        ctx.globalAlpha=.6+Math.random()*.4; ctx.fillRect(-sw/2,-sh/2,sw,sh); ctx.restore();
      }
      ctx.restore();
    }
  }
];

// ─── Frames ──────────────────────────────────────────────────────────────────
const FRAMES = [
  { id:'none', label:'None', icon:'○', draw(ctx,w,h){} },
  {
    id:'classic', label:'Classic', icon:'🟫',
    draw(ctx,w,h) {
      const bw=18;
      ctx.strokeStyle='#c8a060'; ctx.lineWidth=bw; ctx.strokeRect(bw/2,bw/2,w-bw,h-bw);
      ctx.strokeStyle='#8a5a20'; ctx.lineWidth=2; ctx.strokeRect(bw+6,bw+6,w-bw*2-12,h-bw*2-12);
      const dc=(cx,cy,dx,dy)=>{ ctx.strokeStyle='#c8a060'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(cx+dx*8,cy); ctx.lineTo(cx,cy); ctx.lineTo(cx,cy+dy*8); ctx.stroke(); };
      const m=bw+10; dc(m,m,1,1); dc(w-m,m,-1,1); dc(m,h-m,1,-1); dc(w-m,h-m,-1,-1);
    }
  },
  {
    id:'polaroid', label:'Polaroid', icon:'📷',
    draw(ctx,w,h) {
      const top=20,side=20,bot=70;
      ctx.fillStyle='rgba(255,255,255,.95)';
      ctx.fillRect(0,0,w,top); ctx.fillRect(0,0,side,h); ctx.fillRect(w-side,0,side,h); ctx.fillRect(0,h-bot,w,bot);
      ctx.strokeStyle='rgba(0,0,0,.15)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(side+20,h-bot+40); ctx.lineTo(w-side-20,h-bot+40); ctx.stroke();
    }
  },
  {
    id:'neon-border', label:'Neon', icon:'💜',
    draw(ctx,w,h) {
      ['#ff00ff','#00ffff'].forEach((c,i)=>{ ctx.save(); ctx.shadowBlur=20+i*10; ctx.shadowColor=c; ctx.strokeStyle=c; ctx.lineWidth=6; const o=3+i*8; ctx.strokeRect(o,o,w-o*2,h-o*2); ctx.restore(); });
      ctx.save(); ctx.fillStyle='#fff'; ctx.shadowBlur=20; ctx.shadowColor='#fff';
      [[0,0],[w,0],[0,h],[w,h]].forEach(([cx,cy])=>{ ctx.beginPath(); ctx.arc(cx,cy,20,0,Math.PI*2); ctx.fill(); });
      ctx.restore();
    }
  },
  {
    id:'hearts', label:'Love', icon:'💕',
    draw(ctx,w,h) {
      const v=ctx.createRadialGradient(w/2,h/2,h*.25,w/2,h/2,w*.6);
      v.addColorStop(0,'transparent'); v.addColorStop(.8,'transparent'); v.addColorStop(1,'rgba(255,100,150,.4)');
      ctx.fillStyle=v; ctx.fillRect(0,0,w,h);
      const dh=(x,y,s,a)=>{ ctx.save(); ctx.globalAlpha=a; ctx.fillStyle='#ff6090'; ctx.beginPath(); ctx.moveTo(x,y+s*.3); ctx.bezierCurveTo(x,y,x-s,y,x-s,y+s*.3); ctx.bezierCurveTo(x-s,y+s*.65,x,y+s,x,y+s*1.2); ctx.bezierCurveTo(x,y+s,x+s,y+s*.65,x+s,y+s*.3); ctx.bezierCurveTo(x+s,y,x,y,x,y+s*.3); ctx.fill(); ctx.restore(); };
      for (let i=0;i<12;i++) { dh(30+Math.random()*40,i*(h/12)+10,6+Math.random()*6,.3+Math.random()*.5); dh(w-70+Math.random()*40,i*(h/12)+10,6+Math.random()*6,.3+Math.random()*.5); }
    }
  }
];

// ─── Compositor ───────────────────────────────────────────────────────────────
class PhotoboothCompositor {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx    = canvasEl.getContext('2d');
    this.W = 900;
    this.H = 540;
    this.canvas.width  = this.W;
    this.canvas.height = this.H;

    this.themeIdx = 0;
    this.frameIdx = 0;

    // mySlot: 0 = I joined first, 1 = I joined second (for reference)
    this.mySlot = 0;

    this.localMask  = null; // my segmented video frame
    this.remoteMask = null; // peer's segmented video frame

    // Position tracking for overlapping layout
    // { x, y, scale } - allows free positioning
    // NOTE: Each person can ONLY drag their own local video, not the remote person
    this.localPos = { x: this.W * 0.25, y: 0, scale: 1.0, isDragging: false, startX: 0, startY: 0 };
    this.remotePos = { x: this.W * 0.75, y: 0, scale: 1.0, isDragging: false, startX: 0, startY: 0 };
    this.dragTarget = null; // 'local' only

    this.running = false;
    this._raf    = null;
    this._seedRandom();

    // Set up mouse/touch event listeners for dragging
    this._setupDragListeners();
  }

  // ── Drag functionality ───────────────────────────────────────────────────────

  _setupDragListeners() {
    this.canvas.addEventListener('mousedown', (e) => this._onDragStart(e, 'mouse'));
    this.canvas.addEventListener('mousemove', (e) => this._onDragMove(e, 'mouse'));
    this.canvas.addEventListener('mouseup', (e) => this._onDragEnd(e, 'mouse'));

    this.canvas.addEventListener('touchstart', (e) => this._onDragStart(e, 'touch'));
    this.canvas.addEventListener('touchmove', (e) => this._onDragMove(e, 'touch'));
    this.canvas.addEventListener('touchend', (e) => this._onDragEnd(e, 'touch'));

    this.canvas.style.cursor = 'grab';
  }

  _getEventPos(e, type) {
    if (type === 'touch') {
      const touch = e.touches?.[0];
      if (!touch) return null;
      return { x: touch.clientX, y: touch.clientY };
    } else {
      return { x: e.clientX, y: e.clientY };
    }
  }

  _onDragStart(e, type) {
    const pos = this._getEventPos(e, type);
    if (!pos) return;

    const rect = this.canvas.getBoundingClientRect();
    const canvasX = pos.x - rect.left;
    const canvasY = pos.y - rect.top;

    // Scale canvas coordinates to actual canvas size
    const scaleX = this.W / rect.width;
    const scaleY = this.H / rect.height;
    const x = canvasX * scaleX;
    const y = canvasY * scaleY;

    // Only allow dragging YOUR OWN video (local)
    const localBox = this._getPersonBoundingBox(this.localPos);

    if (this.localMask && this._pointInBox(x, y, localBox)) {
      this.dragTarget = 'local';
      this.localPos.isDragging = true;
      this.localPos.startX = x - this.localPos.x;
      this.localPos.startY = y - this.localPos.y;
      this.canvas.style.cursor = 'grabbing';
    }
  }

  _onDragMove(e, type) {
    if (this.dragTarget !== 'local') return;

    const pos = this._getEventPos(e, type);
    if (!pos) return;

    const rect = this.canvas.getBoundingClientRect();
    const canvasX = pos.x - rect.left;
    const canvasY = pos.y - rect.top;

    const scaleX = this.W / rect.width;
    const scaleY = this.H / rect.height;
    const x = canvasX * scaleX;
    const y = canvasY * scaleY;

    this.localPos.x = x - this.localPos.startX;
    this.localPos.y = y - this.localPos.startY;
  }

  _onDragEnd(e, type) {
    if (this.dragTarget === 'local') {
      this.localPos.isDragging = false;
      this.dragTarget = null;
      this.canvas.style.cursor = 'grab';
    }
  }

  _getPersonBoundingBox(pos) {
    // Calculate approximate bounding box for a person (rough estimate)
    const personWidth = this.W * 0.35;
    const personHeight = this.H * 0.8;
    return {
      x: pos.x - personWidth / 2,
      y: pos.y,
      w: personWidth,
      h: personHeight
    };
  }

  _pointInBox(x, y, box) {
    return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  setTheme(idx)      { this.themeIdx = idx; }
  setFrame(idx)      { this.frameIdx = idx; }
  setMySlot(slot)    { this.mySlot   = slot; }          // 0 or 1

  updateLocalMask(canvas)  { this.localMask  = canvas; }
  updateRemoteMask(canvas) { this.remoteMask = canvas; }

  start() { this.running = true;  this._loop(); }
  stop()  { this.running = false; if (this._raf) cancelAnimationFrame(this._raf); }
  snapshot() { return this.canvas.toDataURL('image/jpeg', 0.92); }

  // ── Render loop ─────────────────────────────────────────────────────────────

  _loop() {
    if (!this.running) return;
    this._draw();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _draw() {
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H);

    // 1. Themed background (always full canvas)
    this._drawTheme();

    const hasLocal  = !!this.localMask;
    const hasRemote = !!this.remoteMask;

    // Draw people in overlapping layout:
    // - Always show local video (mirror) if available
    // - Show remote if available
    // Draw in order: local first, then remote (so remote is on top)
    
    if (hasLocal) {
      this._drawPersonAtPos(this.localMask, this.localPos, /*mirror=*/true);
    }

    if (hasRemote) {
      this._drawPersonAtPos(this.remoteMask, this.remotePos, /*mirror=*/false);
    }

    // 2. Decorative frame
    FRAMES[this.frameIdx].draw(ctx, W, H);

    // 3. Date stamp
    this._drawDateStamp();
  }

  /**
   * Draw a segmented-person canvas at a specific position with scale
   */
  _drawPersonAtPos(src, pos, mirror) {
    const sw = src.width, sh = src.height;
    if (!sw || !sh) return;

    const { ctx } = this;

    // Calculate scaled dimensions
    const personWidth = this.W * 0.35 * pos.scale;
    const personHeight = this.H * 0.9 * pos.scale;
    
    // Calculate aspect-ratio aware sizing
    const aspectRatio = sw / sh;
    let dw = personWidth;
    let dh = personWidth / aspectRatio;
    
    if (dh > personHeight) {
      dh = personHeight;
      dw = personHeight * aspectRatio;
    }

    // Position: x is center point, y is top edge
    const dx = pos.x - dw / 2;
    const dy = pos.y;

    ctx.save();
    if (mirror) {
      // Mirror around the center point of the person
      ctx.translate(pos.x, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(src, -dw / 2, dy, dw, dh);
    } else {
      ctx.drawImage(src, dx, dy, dw, dh);
    }
    ctx.restore();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _drawTheme() {
    const saved = Math.random;
    let i = 0;
    Math.random = () => this._rdata[i++ % this._rdata.length].v;
    THEMES[this.themeIdx].draw(this.ctx, this.W, this.H);
    Math.random = saved;
  }

  _drawDateStamp() {
    const { ctx, W, H } = this;
    const date = new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    ctx.save();
    ctx.font='12px "Space Mono", monospace'; ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.textAlign='right'; ctx.textBaseline='bottom';
    ctx.fillText(date, W - 14, H - 10);
    ctx.restore();
  }

  _seedRandom() {
    this._rdata = Array.from({ length: 400 }, () => ({ v: Math.random() }));
  }
}

// ─── Globals ─────────────────────────────────────────────────────────────────
window.THEMES               = THEMES;
window.FRAMES               = FRAMES;
window.PhotoboothCompositor = PhotoboothCompositor;