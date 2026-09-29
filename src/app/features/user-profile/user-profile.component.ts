import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PeopleService } from '../../core/services/people/people.service';
import { Profile } from '../../core/interfaces/user/Profile';
import { ToastService } from '../../core/services/toast/toast.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-user-profile',
  imports: [RouterLink, AvatarComponent, IconComponent],
  templateUrl: './user-profile.component.html'
})
export class UserProfileComponent {
  private readonly people = inject(PeopleService);
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();
  readonly profile = signal<Profile | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly reportOpen = signal(false);
  readonly reportReason = signal('');

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.profile.set(await this.people.profile(this.id()));
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.loading.set(false);
    }
  }

  async toggleLike(): Promise<void> {
    const profile = this.profile();
    if (!profile || this.busy()) return;
    this.busy.set(true);
    try {
      const state = profile.likedByMe
        ? await this.people.unlike(profile.id)
        : await this.people.like(profile.id);
      this.profile.set({ ...profile, ...state });
      this.toast.success(state.connected ? "It's a match!" : state.likedByMe ? 'Liked.' : 'Like removed.');
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.busy.set(false);
    }
  }

  async report(): Promise<void> {
    const profile = this.profile();
    if (!profile || this.busy()) return;
    this.busy.set(true);
    try {
      await this.people.report(profile.id, this.reportReason());
      this.reportOpen.set(false);
      this.toast.success('Report sent. Thank you.');
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.busy.set(false);
    }
  }
}
