/**
 * app.js — Main orchestrator
 * Ties together: Lobby UI → WebRTC → Segmentation → Canvas → Photo capture
 */

// ─── State ───────────────────────────────────────────────────────────────────
let socket       = null;
let localStream  = null;
let rtcManager   = null;
let currentRoom  = null;
let isMuted      = false;
let isCamOff     = false;

let compositor        = null;
let localSeg          = null;
let remoteSeg         = null;
let compositorRunning = false;

// mySlot: 0 = first to join (left side), 1 = second to join (right side)
let mySlot = 0;

// ─── DOM ─────────────────────────────────────────────────────────────────────
const lobbyEl        = document.getElementById('lobby');
const boothEl        = document.getElementById('booth');
const localVideo     = document.getElementById('local-video');
const remoteVideo    = document.getElementById('remote-video');
const waitingOverlay = document.getElementById('waiting-overlay');
const segLoading     = document.getElementById('seg-loading');
const connDot        = document.getElementById('conn-dot');
const connText       = document.getElementById('conn-text');
const roomLabel      = document.getElementById('room-label');
const shareCodeBig   = document.getElementById('share-code-big');
const errorMsg       = document.getElementById('error-msg');
const generatedCode  = document.getElementById('room-code-display');
const photoStrip     = document.getElementById('photo-strip');
const shutterBtn     = document.getElementById('shutter-btn');
const countdownEl    = document.getElementById('countdown-overlay');
const countdownNum   = document.getElementById('countdown-num');
const flashEl        = document.getElementById('flash-overlay');
const themeGrid      = document.getElementById('theme-grid');
const frameGrid      = document.getElementById('frame-grid');
const canvasEl       = document.getElementById('photobooth-canvas');

// ─── Init Theme / Frame selectors ────────────────────────────────────────────
function buildSelectors() {
  THEMES.forEach((t, i) => {
    const btn = document.createElement('button');
    btn.className = 'theme-btn' + (i === 0 ? ' active' : '');
    btn.innerHTML = `<span class="icon">${t.icon}</span>${t.label}`;
    btn.onclick   = () => {
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      compositor?.setTheme(i);
    };
    themeGrid.appendChild(btn);
  });

  FRAMES.forEach((f, i) => {
    const btn = document.createElement('button');
    btn.className = 'frame-btn' + (i === 0 ? ' active' : '');
    btn.innerHTML = `<span class="icon">${f.icon}</span>${f.label}`;
    btn.onclick   = () => {
      document.querySelectorAll('.frame-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      compositor?.setFrame(i);
    };
    frameGrid.appendChild(btn);
  });
}
buildSelectors();

// ─── Lobby ───────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('panel-' + tab).classList.add('active');
  clearError();
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateAndJoin() {
  const code = generateRoomCode();
  generatedCode.textContent = code;
  enterRoom(code);
}

function joinFromInput() {
  const val = document.getElementById('room-input').value.trim().toUpperCase();
  if (val.length < 4) { showError('Enter a valid room code.'); return; }
  enterRoom(val);
}

function copyRoomCode() {
  const c = generatedCode.textContent;
  if (c !== '——————') navigator.clipboard.writeText(c);
}

function copyCurrentRoom() {
  if (currentRoom) navigator.clipboard.writeText(currentRoom);
}

function showError(m) { errorMsg.textContent = m; }
function clearError()  { errorMsg.textContent = ''; }

// ─── Enter Room ───────────────────────────────────────────────────────────────
async function enterRoom(roomId) {
  clearError();

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: true
    });
  } catch (e) {
    showError('Camera/mic access denied.');
    return;
  }

  localVideo.srcObject = localStream;
  currentRoom = roomId;

  showBooth(roomId);

  // Initialize compositor (slot will be set once server replies)
  compositor = new PhotoboothCompositor(canvasEl);
  compositor.start();

  // Initialize local segmentation immediately
  await initLocalSegmentation();

  // Connect socket
  socket = io();
  bindSocketEvents();

  if (socket.connected) {
    socket.emit('join-room', roomId);
  } else {
    socket.once('connect', () => socket.emit('join-room', roomId));
  }
}

async function initLocalSegmentation() {
  segLoading.classList.remove('hidden');

  localSeg = new SegmentationPipeline(localVideo, 'local', (mask) => {
    compositor.updateLocalMask(mask);
  });

  await localSeg.init();
  localSeg.start();
  startSegLoop();

  segLoading.classList.add('hidden');
  compositorRunning = true;
}

async function initRemoteSegmentation() {
  remoteSeg = new SegmentationPipeline(remoteVideo, 'remote', (mask) => {
    compositor.updateRemoteMask(mask);
  });
  await remoteSeg.init();
  remoteSeg.start();
}

function startSegLoop() {
  let lastTime = 0;
  const interval = 1000 / 30; // 30 fps

  const tick = (now) => {
    if (now - lastTime >= interval) {
      localSeg?.processFrame();
      remoteSeg?.processFrame();
      lastTime = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ─── Booth UI ─────────────────────────────────────────────────────────────────
function showBooth(roomId) {
  lobbyEl.classList.remove('active');
  lobbyEl.style.display = 'none';
  boothEl.style.display = 'flex';
  requestAnimationFrame(() => boothEl.style.opacity = '1');
  boothEl.classList.add('active');
  roomLabel.textContent    = roomId;
  shareCodeBig.textContent = roomId;
  setStatus('waiting', 'Waiting for partner…');
}

// ─── Socket Events ────────────────────────────────────────────────────────────
function bindSocketEvents() {

  // ← NEW: server tells us which slot we are (0 = left, 1 = right)
  socket.on('assigned-slot', ({ slot }) => {
    mySlot = slot;
    compositor.setMySlot(slot);
    console.log(`[App] Assigned slot ${slot} → ${slot === 0 ? 'LEFT' : 'RIGHT'} side`);
  });

  socket.on('waiting', () => {
    setStatus('waiting', 'Waiting…');
    showWaiting(true);
  });

  socket.on('room-full', () => {
    showError('Room is full.');
    cleanupAndGoHome();
  });

  socket.on('initiate-call', () => {
    socket._isInitiator = true;
    if (rtcManager) rtcManager.createOffer();
  });

  socket.on('room-ready', async ({ count }) => {
    if (count === 2) {
      setStatus('connecting', 'Connecting…');

      await initRemoteSegmentation();

      rtcManager = new WebRTCManager({
        socket,
        roomId: currentRoom,
        localStream,
        onRemoteStream: handleRemoteStream,
        onConnectionStateChange: handleConnectionState
      });

      if (socket._isInitiator) {
        rtcManager.createOffer();
      }
    }
  });

  socket.on('peer-disconnected', () => {
    setStatus('disconnected', 'Partner left');
    remoteVideo.srcObject = null;
    compositor.updateRemoteMask(null);
    showWaiting(true);
    if (rtcManager) { rtcManager.destroy(); rtcManager = null; }
    if (remoteSeg)  { remoteSeg.destroy();  remoteSeg  = null; }
  });

  socket.on('disconnect', () => setStatus('disconnected', 'Disconnected'));
}

async function handleRemoteStream(stream) {
  remoteVideo.srcObject = stream;
  await remoteVideo.play().catch(() => {});
  await waitForVideo(remoteVideo);
  showWaiting(false);
}

function waitForVideo(video) {
  return new Promise(resolve => {
    if (video.videoWidth > 0) { resolve(); return; }
    video.addEventListener('loadedmetadata', resolve, { once: true });
  });
}

function handleConnectionState(state) {
  if (state === 'connected') {
    setStatus('connected', 'Connected ✓');
  } else if (state === 'disconnected' || state === 'failed') {
    setStatus('disconnected', 'Connection lost');
    showWaiting(true);
  }
}

function showWaiting(show) {
  waitingOverlay.classList.toggle('hidden', !show);
}

function setStatus(type, text) {
  connText.textContent = text;
  connDot.className    = 'dot ' + type;
}

// ─── Controls ────────────────────────────────────────────────────────────────
function toggleMute() {
  if (!localStream) return;
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
  const btn = document.getElementById('btn-mute');
  btn.textContent = isMuted ? '🔇 Mic Off' : '🎤 Mic On';
  btn.classList.toggle('muted', isMuted);
}

function toggleCamera() {
  if (!localStream) return;
  isCamOff = !isCamOff;
  localStream.getVideoTracks().forEach(t => t.enabled = !isCamOff);
  const btn = document.getElementById('btn-cam');
  btn.textContent = isCamOff ? '🚫 Cam Off' : '📹 Cam On';
  btn.classList.toggle('cam-off', isCamOff);
}

function hangUp() { cleanupAndGoHome(); }

function cleanupAndGoHome() {
  if (rtcManager)  { rtcManager.destroy(); rtcManager = null; }
  if (localSeg)    { localSeg.destroy();   localSeg   = null; }
  if (remoteSeg)   { remoteSeg.destroy();  remoteSeg  = null; }
  if (compositor)  { compositor.stop();    compositor = null; }
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  if (socket)      { socket.disconnect(); socket = null; }

  localVideo.srcObject  = null;
  remoteVideo.srcObject = null;
  currentRoom = null;
  mySlot      = 0;

  boothEl.classList.remove('active');
  boothEl.style.opacity = '0';
  boothEl.style.display = 'none';

  photoStrip.innerHTML = '<p class="strip-hint">Your photos appear here ↓</p>';

  lobbyEl.style.display = 'flex';
  requestAnimationFrame(() => lobbyEl.style.opacity = '1');
  lobbyEl.classList.add('active');

  generatedCode.textContent = '——————';
  document.getElementById('room-input').value = '';
  clearError();
}

// ─── Photo capture ───────────────────────────────────────────────────────────
let countdownActive = false;

function startCountdown() {
  if (countdownActive) return;
  countdownActive = true;
  shutterBtn.disabled = true;

  let count = 3;
  countdownEl.classList.add('active');
  countdownNum.textContent = count;

  const tick = () => {
    count--;
    if (count <= 0) {
      countdownEl.classList.remove('active');
      capturePhoto();
      countdownActive = false;
      shutterBtn.disabled = false;
      return;
    }
    countdownNum.textContent = count;
    countdownNum.style.animation = 'none';
    void countdownNum.offsetWidth;
    countdownNum.style.animation = 'countdown-pop 1s ease-out';
    setTimeout(tick, 1000);
  };
  setTimeout(tick, 1000);
}

function capturePhoto() {
  flashEl.classList.add('flash');
  setTimeout(() => flashEl.classList.remove('flash'), 200);

  const dataUrl = compositor.snapshot();

  const hint = photoStrip.querySelector('.strip-hint');
  if (hint) hint.remove();

  const img = document.createElement('img');
  img.className = 'strip-photo';
  img.src       = dataUrl;
  img.title     = 'Click to download';
  img.onclick   = () => downloadPhoto(dataUrl);
  photoStrip.appendChild(img);
  photoStrip.scrollTo({ left: photoStrip.scrollWidth, behavior: 'smooth' });
}

function downloadPhoto(dataUrl) {
  const a    = document.createElement('a');
  a.href     = dataUrl;
  a.download = `photobooth-${Date.now()}.jpg`;
  a.click();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.getElementById('room-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') joinFromInput();
});
document.getElementById('room-input').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase();
});