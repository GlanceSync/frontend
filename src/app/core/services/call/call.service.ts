import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RealtimeService } from '../realtime/realtime.service';
import { CallSignal } from '../../interfaces/call/CallSignal';

/** Used when the server cannot be asked; enough for calls on the same network. */
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

export type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'active';

interface ActiveCall {
  callId: string | null;
  peerId: string;
  peerName: string;
  peerAvatarUrl?: string;
  mode: 'audio' | 'video';
  incoming: boolean;
}

/**
 * Drives WebRTC. Media flows directly between the two browsers; the server only
 * relays the offer, answer and ICE candidates needed to establish that connection.
 */
@Injectable({ providedIn: 'root' })
export class CallService {
  private readonly realtime = inject(RealtimeService);
  private readonly http = inject(HttpClient);

  readonly state = signal<CallState>('idle');
  readonly call = signal<ActiveCall | null>(null);
  readonly error = signal<string | null>(null);
  readonly localStream = signal<MediaStream | null>(null);
  readonly remoteStream = signal<MediaStream | null>(null);
  readonly micEnabled = signal(true);
  readonly cameraEnabled = signal(true);

  /** Something the user should know about their own devices, shown during the call. */
  readonly notice = signal<string | null>(null);

  readonly isVideo = computed(() => this.call()?.mode === 'video');

  private peer: RTCPeerConnection | null = null;

  /**
   * Candidates that arrive before the remote description is set cannot be added yet,
   * so they are held here and flushed once the description lands.
   */
  private pendingCandidates: RTCIceCandidateInit[] = [];

  /** The offer we received but have not answered yet. */
  private pendingOffer: RTCSessionDescriptionInit | null = null;

  /**
   * Our own ICE candidates produced before the server has told us the call id.
   * They must be held rather than dropped, or the connection may never establish.
   */
  private outgoingCandidates: RTCIceCandidateInit[] = [];

  constructor() {
    // Subscriptions, not effects: every signal must be handled, and ICE arrives in bursts.
    this.realtime.callSignals.subscribe(message => void this.onSignal(message));

    this.realtime.callEnded.subscribe(ended => {
      // Ignore an ending that refers to some other call than the one on screen.
      const current = this.call();
      if (current?.callId && ended.callId && current.callId !== ended.callId) {
        return;
      }
      this.finish(this.reasonText(ended.reason));
    });
  }

  /** Places a call. Media is captured first so we never ring without a working device. */
  async start(
    peerId: string,
    peerName: string,
    mode: 'audio' | 'video',
    peerAvatarUrl?: string
  ): Promise<void> {
    if (this.state() !== 'idle') {
      return;
    }
    this.error.set(null);
    this.call.set({ callId: null, peerId, peerName, peerAvatarUrl, mode, incoming: false });
    this.state.set('calling');

    try {
      const [iceServers] = await Promise.all([this.loadIceServers(), this.capture(mode)]);
      const peer = this.createPeer(iceServers);
      this.receiveWhatWeCannotSend(peer, mode);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      this.realtime.offerCall(peerId, mode, { type: offer.type, sdp: offer.sdp });
    } catch (error) {
      this.finish(this.mediaErrorText(error));
    }
  }

  /**
   * Answers the call that is currently ringing. A video call can be answered without
   * our camera: we still receive their video, we just send none.
   */
  async accept(withVideo = true): Promise<void> {
    const current = this.call();
    if (!current?.callId || !this.pendingOffer) {
      // Nothing to answer: clear the stale dialog instead of leaving it stuck.
      this.finish('That call is no longer available.');
      return;
    }
    this.state.set('connecting');

    try {
      const [iceServers] = await Promise.all([
        this.loadIceServers(),
        this.capture(withVideo ? current.mode : 'audio')
      ]);
      const peer = this.createPeer(iceServers);
      await peer.setRemoteDescription(new RTCSessionDescription(this.pendingOffer));
      await this.flushCandidates();

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      this.realtime.answerCall(current.callId, { type: answer.type, sdp: answer.sdp });
      this.pendingOffer = null;
    } catch (error) {
      this.hangUp();
      this.error.set(this.mediaErrorText(error));
    }
  }

  reject(): void {
    const callId = this.call()?.callId;
    if (callId) {
      this.realtime.rejectCall(callId);
    }
    this.finish(null);
  }

  hangUp(): void {
    const callId = this.call()?.callId;
    if (callId) {
      this.realtime.hangUp(callId);
    }
    this.finish(null);
  }

  toggleMic(): void {
    const track = this.localStream()?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      this.micEnabled.set(track.enabled);
    }
  }

  toggleCamera(): void {
    const track = this.localStream()?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      this.cameraEnabled.set(track.enabled);
    }
  }

  dismissError(): void {
    this.error.set(null);
  }

  private async onSignal(message: CallSignal): Promise<void> {
    switch (message.type) {
      case 'call:ringing': {
        // The server assigned the id; attach it so later signals can be matched.
        this.call.update(current => (current ? { ...current, callId: message.callId } : current));
        this.flushOutgoingCandidates(message.callId);
        break;
      }
      case 'call:incoming': {
        if (this.state() !== 'idle') {
          // Already on a call: decline the new one and keep the current one intact.
          this.realtime.rejectCall(message.callId);
          return;
        }
        this.pendingOffer = message.payload as unknown as RTCSessionDescriptionInit;
        this.call.set({
          callId: message.callId,
          peerId: message.fromUserId,
          peerName: message.fromUsername ?? 'Someone',
          peerAvatarUrl: message.fromAvatarUrl,
          mode: message.mode,
          incoming: true
        });
        this.state.set('ringing');
        break;
      }
      case 'call:answered': {
        if (!this.peer) {
          return;
        }
        await this.peer.setRemoteDescription(
          new RTCSessionDescription(message.payload as unknown as RTCSessionDescriptionInit)
        );
        await this.flushCandidates();
        this.state.set('connecting');
        break;
      }
      case 'call:ice': {
        const candidate = message.payload as unknown as RTCIceCandidateInit;
        if (!candidate) {
          return;
        }
        if (this.peer?.remoteDescription) {
          await this.peer.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          this.pendingCandidates.push(candidate);
        }
        break;
      }
    }
  }

  /**
   * STUN finds a direct path; TURN relays the media when the two networks cannot reach
   * each other (mobile data, hotspots, strict NATs). TURN credentials are short-lived,
   * so they are fetched fresh for every call rather than cached.
   */
  private async loadIceServers(): Promise<RTCIceServer[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ iceServers: RTCIceServer[] }>('/api/calls/ice-servers')
      );
      return response.iceServers?.length ? response.iceServers : FALLBACK_ICE_SERVERS;
    } catch {
      // A call without a relay may still connect, so this is not worth failing over.
      return FALLBACK_ICE_SERVERS;
    }
  }

  private createPeer(iceServers: RTCIceServer[]): RTCPeerConnection {
    const peer = new RTCPeerConnection({ iceServers });

    for (const track of this.localStream()?.getTracks() ?? []) {
      peer.addTrack(track, this.localStream()!);
    }

    peer.ontrack = event => {
      this.remoteStream.set(event.streams[0]);
      this.state.set('active');
    };

    peer.onicecandidate = event => {
      if (!event.candidate) {
        return;
      }
      const callId = this.call()?.callId;
      if (callId) {
        this.realtime.sendIce(callId, event.candidate.toJSON());
      } else {
        // The caller starts producing candidates before call:ringing arrives.
        this.outgoingCandidates.push(event.candidate.toJSON());
      }
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        this.state.set('active');
      } else if (peer.connectionState === 'failed') {
        this.finish('The connection failed. You may be on networks that cannot reach each other.');
      }
    };

    this.peer = peer;
    return peer;
  }

  /**
   * Gets the microphone and, for video, the camera. Asking for both at once fails when
   * either is missing or busy (a MacBook with its lid closed, a camera held by another
   * app), so the call steps down instead: without a camera, audio only; without a
   * microphone, video only; with neither, the user can still see and hear the other side.
   * Only a refused permission stops the call, since asking again would not help.
   */
  private async capture(mode: 'audio' | 'video'): Promise<void> {
    // Browsers only expose mediaDevices in a secure context: https, or localhost.
    // Reaching the app over a plain-http LAN address leaves it undefined.
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('insecure-context');
    }

    const attempts: MediaStreamConstraints[] =
      mode === 'video'
        ? [{ audio: true, video: true }, { audio: true }, { video: true }]
        : [{ audio: true }];

    let firstFailure: string | undefined;
    let stream: MediaStream | null = null;
    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (error) {
        const name = (error as { name?: string })?.name ?? '';
        if (!CallService.MISSING_DEVICE_ERRORS.has(name)) {
          throw error;
        }
        firstFailure ??= name;
      }
    }

    const hasAudio = (stream?.getAudioTracks().length ?? 0) > 0;
    const hasVideo = (stream?.getVideoTracks().length ?? 0) > 0;
    this.localStream.set(stream);
    this.micEnabled.set(hasAudio);
    this.cameraEnabled.set(hasVideo);
    this.notice.set(this.deviceNotice(mode, hasAudio, hasVideo, firstFailure));
  }

  /** Errors that mean "this device is missing or unusable", as opposed to "not allowed". */
  private static readonly MISSING_DEVICE_ERRORS = new Set([
    'NotFoundError',
    'NotReadableError',
    'OverconstrainedError',
    'AbortError'
  ]);

  private deviceNotice(
    mode: 'audio' | 'video',
    hasAudio: boolean,
    hasVideo: boolean,
    failure: string | undefined
  ): string | null {
    const busy = failure === 'NotReadableError';
    if (mode === 'video' && hasAudio && !hasVideo) {
      return busy
        ? 'Your camera is being used by another app, so you joined with audio only.'
        : 'No camera was found, so you joined with audio only.';
    }
    if (!hasAudio && hasVideo) {
      return busy
        ? 'Your microphone is being used by another app. They can see you but not hear you.'
        : 'No microphone was found. They can see you but not hear you.';
    }
    if (!hasAudio && !hasVideo) {
      return busy
        ? 'Your microphone and camera are being used by another app. You can see and hear them, but they cannot see or hear you.'
        : 'No microphone or camera was found. You can see and hear them, but they cannot see or hear you.';
    }
    return null;
  }

  /**
   * An offer only describes media we send, so a caller without a camera must still ask
   * for the other side's video (and likewise audio), or the callee could not send theirs.
   */
  private receiveWhatWeCannotSend(peer: RTCPeerConnection, mode: 'audio' | 'video'): void {
    const stream = this.localStream();
    if (!stream?.getAudioTracks().length) {
      peer.addTransceiver('audio', { direction: 'recvonly' });
    }
    if (mode === 'video' && !stream?.getVideoTracks().length) {
      peer.addTransceiver('video', { direction: 'recvonly' });
    }
  }

  private flushOutgoingCandidates(callId: string): void {
    const queued = this.outgoingCandidates;
    this.outgoingCandidates = [];
    for (const candidate of queued) {
      this.realtime.sendIce(callId, candidate);
    }
  }

  private async flushCandidates(): Promise<void> {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) {
      await this.peer?.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  /** Tears everything down. Tracks must be stopped or the camera light stays on. */
  private finish(message: string | null): void {
    for (const track of this.localStream()?.getTracks() ?? []) {
      track.stop();
    }
    this.peer?.close();
    this.peer = null;
    this.pendingCandidates = [];
    this.outgoingCandidates = [];
    this.pendingOffer = null;
    this.localStream.set(null);
    this.notice.set(null);
    this.remoteStream.set(null);
    this.call.set(null);
    this.state.set('idle');
    if (message) {
      this.error.set(message);
    }
  }

  private reasonText(reason: string): string | null {
    switch (reason) {
      case 'offline':
        return 'They are not online right now.';
      case 'rejected':
        return 'Your call was declined.';
      case 'disconnected':
        return 'They lost their connection.';
      case 'unknown':
        return 'That person no longer exists.';
      case 'invalid':
        return 'That call could not be placed.';
      default:
        return null;
    }
  }

  private mediaErrorText(error: unknown): string {
    if ((error as Error)?.message === 'insecure-context') {
      return 'Calls need https or localhost. Open the app on localhost to use the microphone and camera.';
    }
    const name = (error as { name?: string })?.name;
    if (name === 'NotAllowedError') {
      // Chrome says "by system" when the OS, not the site settings, is blocking it.
      if (/system/i.test((error as Error)?.message ?? '')) {
        return 'Your computer is blocking the browser from using the microphone and camera. On a Mac, allow it in System Settings → Privacy & Security → Camera and Microphone, then restart the browser.';
      }
      return 'Permission to use the microphone or camera was denied. Allow it from the lock icon next to the address bar, then try again.';
    }
    if (name === 'SecurityError') {
      return 'The browser blocked access to the microphone and camera on this page.';
    }
    return 'Could not start the call.';
  }
}
