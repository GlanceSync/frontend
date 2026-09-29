import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivityService } from '../../core/services/activity/activity.service';
import { ProfileActivity } from '../../core/interfaces/user/Profile';
import { ToastService } from '../../core/services/toast/toast.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-activity',
  imports: [RouterLink, AvatarComponent],
  templateUrl: './activity.component.html'
})
export class ActivityComponent {
  private readonly activity = inject(ActivityService);
  private readonly toast = inject(ToastService);

  readonly likedBy = signal<ProfileActivity[]>([]);
  readonly views = signal<ProfileActivity[]>([]);
  readonly loading = signal(true);

  constructor() { void this.load(); }

  async load(): Promise<void> {
    try {
      const [likedBy, views] = await Promise.all([this.activity.likedBy(), this.activity.profileViews()]);
      this.likedBy.set(likedBy);
      this.views.set(views);
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.loading.set(false);
    }
  }

  when(iso: string): string { return new Date(iso).toLocaleString(); }
}
