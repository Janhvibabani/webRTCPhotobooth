/**
 * segmentation.js
 * Wraps MediaPipe SelfieSegmentation for one video stream.
 * Outputs a mask canvas that the photobooth compositor reads each frame.
 */

class SegmentationPipeline {
  /**
   * @param {HTMLVideoElement} videoEl   — source video
   * @param {string}           label     — 'local' | 'remote' (for logging)
   * @param {function}         onResult  — called with (maskCanvas) each frame
   */
  constructor(videoEl, label, onResult) {
    this.video    = videoEl;
    this.label    = label;
    this.onResult = onResult;
    this.active   = false;
    this.seg      = null;

    // Offscreen canvas where we draw the masked person
    this.outputCanvas = document.createElement('canvas');
    this.outputCtx    = this.outputCanvas.getContext('2d');

    // Temp canvas for segmentation input (full-res copy of video)
    this._inputCanvas = document.createElement('canvas');
    this._inputCtx    = this._inputCanvas.getContext('2d');
  }

  async init() {
    this.seg = new SelfieSegmentation({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/${file}`
    });

    this.seg.setOptions({
      modelSelection: 1,   // 0 = general, 1 = landscape (better quality)
      selfieMode: false
    });

    this.seg.onResults((results) => this._onSegResults(results));

    await this.seg.initialize();
    console.log(`[Seg:${this.label}] Ready`);
    return this;
  }

  _onSegResults(results) {
    const w = results.image.width;
    const h = results.image.height;

    this.outputCanvas.width  = w;
    this.outputCanvas.height = h;

    const ctx = this.outputCtx;
    ctx.clearRect(0, 0, w, h);

    // 1. Draw segmentation mask to extract the person
    ctx.save();

    // Use the segmentation mask as a clipping mask via compositing
    ctx.drawImage(results.segmentationMask, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(results.image, 0, 0, w, h);

    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';

    // Deliver to consumer
    this.onResult(this.outputCanvas);
  }

  async processFrame() {
    if (!this.active || !this.video || this.video.readyState < 2) return;

    const w = this.video.videoWidth;
    const h = this.video.videoHeight;
    if (w === 0 || h === 0) return;

    this._inputCanvas.width  = w;
    this._inputCanvas.height = h;
    this._inputCtx.drawImage(this.video, 0, 0, w, h);

    try {
      await this.seg.send({ image: this._inputCanvas });
    } catch(e) {
      // Frame dropped — fine, move on
    }
  }

  start() { this.active = true; }
  stop()  { this.active = false; }

  destroy() {
    this.active = false;
    if (this.seg) this.seg.close();
  }
}