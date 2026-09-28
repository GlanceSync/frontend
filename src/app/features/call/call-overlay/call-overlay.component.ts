import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CallService } from '../../../core/services/call/call.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { avatarHue } from '../../../core/utils/avatar-hue.util';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

/**
 * The call UI. It lives in the app shell rather than on a page, so an incoming call
 * reaches the user wherever they are.
 */
@Component({
  selector: 'app-call-overlay',
  imports: [IconComponent, NgTemplateOutlet, AvatarComponent],
  templateUrl: './call-overlay.component.html'
})
export class CallOverlayComponent {
  private readonly calls = inject(CallService);

  readonly state = this.calls.state;
  readonly call = this.calls.call;
  readonly isVideo = this.calls.isVideo;
  readonly micEnabled = this.calls.micEnabled;
  readonly cameraEnabled = this.calls.cameraEnabled;

  /** Whether we are sending video. False while ringing, or after answering audio-only. */
  readonly notice = this.calls.notice;

  /** False when no microphone could be opened, so there is nothing to mute. */
  readonly hasLocalAudio = computed(
    () => (this.calls.localStream()?.getAudioTracks().length ?? 0) > 0
  );

  readonly hasLocalVideo = computed(
    () => (this.calls.localStream()?.getVideoTracks().length ?? 0) > 0
  );

  /**
   * Whether their video is on screen. A video call they answered audio-only sends us
   * no video track, and then their photo is shown instead of a black frame.
   */
  readonly showRemoteVideo = computed(
    () =>
      this.isVideo() &&
      this.state() === 'active' &&
      (this.calls.remoteStream()?.getVideoTracks().length ?? 0) > 0
  );

  /** Seconds since the call connected, for the timer shown in place of a status. */
  readonly elapsed = signal(0);

  /** The element handed to the Fullscreen API: video plus the controls over it. */
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');

  /** Mirrors the browser's fullscreen state, including changes we did not initiate. */
  readonly isFullscreen = signal(false);

  private readonly localVideo = viewChild<ElementRef<HTMLVideoElement>>('localVideo');
  private readonly remoteVideo = viewChild<ElementRef<HTMLVideoElement>>('remoteVideo');
  private readonly remoteAudio = viewChild<ElementRef<HTMLAudioElement>>('remoteAudio');

  constructor() {
    // The timer runs only while connected, and restarts from zero for the next call.
    effect(onCleanup => {
      if (this.state() !== 'active') {
        this.elapsed.set(0);
        return;
      }
      const startedAt = Date.now();
      const timer = setInterval(
        () => this.elapsed.set(Math.floor((Date.now() - startedAt) / 1000)),
        1000
      );
      onCleanup(() => clearInterval(timer));
    });

    // Escape and F11 change fullscreen without going through our button, so the
    // browser is the source of truth rather than our own flag.
    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', () =>
        this.isFullscreen.set(document.fullscreenElement !== null)
      );
    }

    // Leaving the call should not leave the browser stuck in fullscreen.
    effect(() => {
      if (this.state() === 'idle' && typeof document !== 'undefined' && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      }
    });

    // MediaStream is attached imperatively; it cannot be bound in a template.
    effect(() => {
      const stream = this.calls.localStream();
      const element = this.localVideo()?.nativeElement;
      if (element) {
        element.srcObject = stream;
      }
    });

    effect(() => {
      const stream = this.calls.remoteStream();
      const video = this.remoteVideo()?.nativeElement;
      const audio = this.remoteAudio()?.nativeElement;
      if (video) {
        video.srcObject = stream;
      }
      if (audio) {
        audio.srcObject = stream;
      }
    });
  }

  accept(withVideo = true): void {
    void this.calls.accept(withVideo);
  }

  reject(): void {
    this.calls.reject();
  }

  hangUp(): void {
    this.calls.hangUp();
  }

  toggleMic(): void {
    this.calls.toggleMic();
  }

  toggleCamera(): void {
    this.calls.toggleCamera();
  }

  hue(): number {
    return avatarHue(this.call()?.peerName);
  }

  /** Double-click enlarges a live video call, as in any player. */
  onStageDoubleClick(): void {
    if (this.isVideo() && this.state() === 'active') {
      void this.toggleFullscreen();
    }
  }

  /** Fullscreen is only meaningful for video; an audio call has nothing to enlarge. */
  async toggleFullscreen(): Promise<void> {
    const element = this.stage()?.nativeElement;
    if (!element?.requestFullscreen) {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await element.requestFullscreen();
      }
    } catch {
      // A refused request is not worth interrupting the call over.
    }
  }

  /** m:ss, or h:mm:ss once a call passes the hour. */
  duration(): string {
    const total = this.elapsed();
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
      : `${minutes}:${seconds}`;
  }

  statusText(): string {
    switch (this.state()) {
      case 'calling':
        return 'Ringing…';
      case 'ringing':
        return this.isVideo() ? 'Incoming video call' : 'Incoming voice call';
      case 'connecting':
        return 'Connecting…';
      case 'active':
        return this.duration();
      default:
        return '';
    }
  }
}
