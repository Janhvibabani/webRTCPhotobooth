/**
 * webrtc.js — PeerConnection lifecycle management
 * Handles: offer/answer, ICE candidates, media tracks
 */

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

class WebRTCManager {
  constructor({ socket, roomId, localStream, onRemoteStream, onConnectionStateChange }) {
    this.socket = socket;
    this.roomId = roomId;
    this.localStream = localStream;
    this.onRemoteStream = onRemoteStream;
    this.onConnectionStateChange = onConnectionStateChange;

    this.pc = null;
    this._init();
  }

  _init() {
    console.log('[WebRTC] Initializing PeerConnection...');
    this.pc = new RTCPeerConnection(ICE_SERVERS);
    console.log('[WebRTC] PeerConnection created');

    this.localStream.getTracks().forEach(track => {
      console.log(`[WebRTC] Adding local ${track.kind} track`);
      this.pc.addTrack(track, this.localStream);
    });

    this.pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      const [remoteStream] = event.streams;
      this.onRemoteStream(remoteStream);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] New ICE candidate:', event.candidate.candidate.substring(0, 50) + '...');
        this.socket.emit('ice-candidate', {
          roomId: this.roomId,
          candidate: event.candidate
        });
      } else {
        console.log('[WebRTC] ICE candidate gathering complete');
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', this.pc.connectionState);
      this.onConnectionStateChange(this.pc.connectionState);
    };

    this._bindSocketEvents();
  }

  _bindSocketEvents() {
    this.socket.on('offer', async ({ offer, from }) => {
      console.log(`[WebRTC] Received offer from ${from}`);
      try {
        // Modern browsers: pass the object directly
        await this.pc.setRemoteDescription(offer);
        console.log('[WebRTC] Remote description set, creating answer...');
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        console.log('[WebRTC] Answer created and set, sending...');
        this.socket.emit('answer', { roomId: this.roomId, answer });
      } catch (err) {
        console.error('[WebRTC] Offer error:', err);
      }
    });

    this.socket.on('answer', async ({ answer, from }) => {
      console.log(`[WebRTC] Received answer from ${from}`);
      try {
        // Modern browsers: pass the object directly
        await this.pc.setRemoteDescription(answer);
        console.log('[WebRTC] Remote answer description set');
      } catch (err) {
        console.error('[WebRTC] Answer error:', err);
      }
    });

    this.socket.on('ice-candidate', async ({ candidate, from }) => {
      if (!candidate) return;
      try {
        console.log(`[WebRTC] Adding ICE candidate from ${from}`);
        // Modern browsers: pass the object directly
        await this.pc.addIceCandidate(candidate);
      } catch (err) {
        // Ignore errors for candidates that can't be added (e.g., duplicate)
        console.debug('[WebRTC] ICE candidate error (may be normal):', err.message);
      }
    });
  }

  async createOffer() {
    try {
      console.log('[WebRTC] Creating offer...');
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      console.log('[WebRTC] Offer created, setting local description...');
      await this.pc.setLocalDescription(offer);
      console.log('[WebRTC] Local description set, sending offer to peer...');
      this.socket.emit('offer', { roomId: this.roomId, offer });
      console.log('[WebRTC] Offer sent');
    } catch (err) {
      console.error('[WebRTC] Create offer error:', err);
    }
  }

  destroy() {
    this.socket.off('offer');
    this.socket.off('answer');
    this.socket.off('ice-candidate');
    if (this.pc) { this.pc.close(); this.pc = null; }
  }
}