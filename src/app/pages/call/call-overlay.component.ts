import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { CallService } from '../../core/call.service';
import { IconComponent } from '../../shared/icon.component';
import { avatarHue } from '../../shared/avatar-hue';

/**
 * The call UI. It lives in the app shell rather than on a page, so an incoming call
 * reaches the user wherever they are.
 */
@Component({
  selector: 'app-call-overlay',
  imports: [IconComponent],
  templateUrl: './call-overlay.component.html'
})
export class CallOverlayComponent {
  private readonly calls = inject(CallService);

  readonly state = this.calls.state;
  readonly call = this.calls.call;
  readonly error = this.calls.error;
  readonly isVideo = this.calls.isVideo;
  readonly micEnabled = this.calls.micEnabled;
  readonly cameraEnabled = this.calls.cameraEnabled;

  /** The element handed to the Fullscreen API: video plus the controls over it. */
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');

  /** Mirrors the browser's fullscreen state, including changes we did not initiate. */
  readonly isFullscreen = signal(false);

  private readonly localVideo = viewChild<ElementRef<HTMLVideoElement>>('localVideo');
  private readonly remoteVideo = viewChild<ElementRef<HTMLVideoElement>>('remoteVideo');
  private readonly remoteAudio = viewChild<ElementRef<HTMLAudioElement>>('remoteAudio');

  constructor() {
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

  accept(): void {
    void this.calls.accept();
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

  dismissError(): void {
    this.calls.dismissError();
  }

  hue(): number {
    return avatarHue(this.call()?.peerName);
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

  statusText(): string {
    switch (this.state()) {
      case 'calling':
        return 'Ringing…';
      case 'ringing':
        return this.isVideo() ? 'Incoming video call' : 'Incoming voice call';
      case 'connecting':
        return 'Connecting…';
      case 'active':
        return 'Connected';
      default:
        return '';
    }
  }
}
