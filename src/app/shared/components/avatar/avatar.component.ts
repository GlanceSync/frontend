import { Component, computed, input, signal } from '@angular/core';
import { avatarHue } from '../../../core/utils/avatar-hue.util';

/**
 * A person's avatar: their profile photo when they have one, otherwise their initial
 * on a colour of their own. Size and placement come from classes on the host
 * (`avatar-small`, `avatar-xl`, …), and anything projected — a presence dot — sits on top.
 */
@Component({
  selector: 'app-avatar',
  host: {
    class: 'avatar',
    'aria-hidden': 'true',
    '[style.--avatar-hue]': 'hue()'
  },
  template: `
    @if (showPhoto()) {
      <img class="avatar-img" [src]="src()" alt="" draggable="false"
           (error)="failedSrc.set(src())" />
    } @else {
      {{ initial() }}
    }
    <ng-content />
  `
})
export class AvatarComponent {
  readonly name = input<string | null | undefined>();
  readonly src = input<string | null | undefined>();

  /** A photo that failed to load falls back to the initial rather than a broken image. */
  protected readonly failedSrc = signal<string | null | undefined>(null);

  protected readonly showPhoto = computed(() => Boolean(this.src()) && this.src() !== this.failedSrc());
  protected readonly hue = computed(() => avatarHue(this.name()));
  protected readonly initial = computed(() => (this.name() || '?').charAt(0).toUpperCase());
}
