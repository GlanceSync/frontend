import { Component, DestroyRef, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';

/** Side of the square the photo is stored at: sharp at every size we draw it. */
const AVATAR_SIZE = 256;

/** Refuse obviously wrong picks before spending time decoding them. */
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

@Component({
  selector: 'app-profile',
  imports: [AvatarComponent, IconComponent],
  templateUrl: './profile.component.html'
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);

  readonly user = this.auth.currentUser;

  /** The cropped image waiting for "Save", and a URL to preview it with. */
  readonly pending = signal<{ blob: Blob; url: string } | null>(null);

  readonly busy = signal(false);
  readonly dragging = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.discardPending());
  }

  onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset so choosing the same file again still fires a change.
    input.value = '';
    if (file) {
      void this.prepare(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void this.prepare(file);
    }
  }

  async save(): Promise<void> {
    const pending = this.pending();
    if (!pending || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.uploadAvatar(pending.blob);
      this.discardPending();
      this.notice.set('Profile photo updated.');
    } catch (error) {
      this.error.set(AuthService.toApiError(error).message);
    } finally {
      this.busy.set(false);
    }
  }

  cancel(): void {
    this.discardPending();
    this.error.set(null);
  }

  async remove(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await this.auth.removeAvatar();
      this.notice.set('Profile photo removed.');
    } catch (error) {
      this.error.set(AuthService.toApiError(error).message);
    } finally {
      this.busy.set(false);
    }
  }

  /** Crops the picked image to a centred square and shrinks it before anything is sent. */
  private async prepare(file: File): Promise<void> {
    this.error.set(null);
    this.notice.set(null);

    if (!file.type.startsWith('image/')) {
      this.error.set('That file is not an image.');
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      this.error.set('That image is too large. Choose one under 15 MB.');
      return;
    }

    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      this.error.set('That image could not be read. Try a JPEG or PNG.');
      return;
    }

    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext('2d')!;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE
    );
    bitmap.close();

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9)
    );
    if (!blob) {
      this.error.set('That image could not be processed.');
      return;
    }

    this.discardPending();
    this.pending.set({ blob, url: URL.createObjectURL(blob) });
  }

  private discardPending(): void {
    const pending = this.pending();
    if (pending) {
      URL.revokeObjectURL(pending.url);
      this.pending.set(null);
    }
  }
}
