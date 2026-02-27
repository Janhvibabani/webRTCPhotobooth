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
    this.pc = new RTCPeerConnection(ICE_SERVERS);

    this.localStream.getTracks().forEach(track => {
      this.pc.addTrack(track, this.localStream);
    });

    this.pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      this.onRemoteStream(remoteStream);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', {
          roomId: this.roomId,
          candidate: event.candidate
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', this.pc.connectionState);
      this.onConnectionStateChange(this.pc.connectionState);
    };

    this._bindSocketEvents();
  }

  _bindSocketEvents() {
    this.socket.on('offer', async ({ offer }) => {
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.socket.emit('answer', { roomId: this.roomId, answer });
      } catch (err) {
        console.error('[WebRTC] Offer error:', err);
      }
    });

    this.socket.on('answer', async ({ answer }) => {
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error('[WebRTC] Answer error:', err);
      }
    });

    this.socket.on('ice-candidate', async ({ candidate }) => {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[WebRTC] ICE error:', err);
      }
    });
  }

  async createOffer() {
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await this.pc.setLocalDescription(offer);
      this.socket.emit('offer', { roomId: this.roomId, offer });
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