import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PeopleService } from '../../core/services/people/people.service';
import { ProfileService } from '../../core/services/profile/profile.service';
import { ActivityService } from '../../core/services/activity/activity.service';
import { Profile } from '../../core/interfaces/user/Profile';
import { ToastService } from '../../core/services/toast/toast.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { RealtimeService } from '../../core/services/realtime/realtime.service';

@Component({
  selector: 'app-user-profile',
  imports: [RouterLink, AvatarComponent, IconComponent],
  templateUrl: './user-profile.component.html'
})
export class UserProfileComponent {
  private readonly people = inject(PeopleService);
  private readonly profiles = inject(ProfileService);
  private readonly activity = inject(ActivityService);
  private readonly toast = inject(ToastService);
  private readonly realtime = inject(RealtimeService);

  readonly id = input.required<string>();
  readonly profile = signal<Profile | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly reportOpen = signal(false);
  readonly blockOpen = signal(false);
  readonly reportReason = signal('');
  readonly isOnline = computed(() => {
    const profile = this.profile();
    if (!profile) return false;
    return this.realtime.connected()
      ? this.realtime.onlineUserIds().has(profile.id)
      : profile.online;
  });
  readonly lastSeenAt = computed(() => {
    const profile = this.profile();
    if (!profile) return null;
    return this.realtime.lastSeenAt().get(profile.id) ?? profile.lastSeenAt ?? null;
  });

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.profile.set(await this.profiles.profile(this.id()));
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.loading.set(false);
    }
  }

  async toggleLike(): Promise<void> {
    const profile = this.profile();
    if (!profile || profile.blocked || profile.blockedByThem || this.busy()) return;
    this.busy.set(true);
    try {
      const state = profile.likedByMe
        ? await this.activity.unlike(profile.id)
        : await this.activity.like(profile.id);
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

  async toggleBlock(): Promise<void> {
    const profile = this.profile();
    if (!profile || this.busy()) return;
    this.blockOpen.set(false);
    this.busy.set(true);
    try {
      if (profile.blocked) {
        await this.people.unblock(profile.id);
        this.toast.success(`${profile.username} is unblocked.`);
      } else {
        await this.people.block(profile.id);
        this.toast.success(`${profile.username} is blocked.`);
      }
      // Re-read rather than guess: likes survive a block, so the server knows the real state.
      this.profile.set(await this.profiles.profile(profile.id));
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.busy.set(false);
    }
  }

  genderLabel(value: Profile['gender']): string {
    return value === 'MALE' ? 'Man' : value === 'FEMALE' ? 'Woman' : 'Not specified';
  }

  preferenceLabel(value: Profile['sexualPreference']): string {
    switch (value) {
      case 'HETEROSEXUAL': return 'Opposite gender';
      case 'HOMOSEXUAL': return 'Same gender';
      case 'BISEXUAL': return 'Everyone';
      default: return 'Not specified';
    }
  }

  when(iso: string): string {
    return new Date(iso).toLocaleString();
  }
}
