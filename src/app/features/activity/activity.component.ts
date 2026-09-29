import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PeopleService } from '../../core/services/people/people.service';
import { ProfileActivity } from '../../core/interfaces/user/Profile';
import { ToastService } from '../../core/services/toast/toast.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-activity',
  imports: [RouterLink, AvatarComponent],
  templateUrl: './activity.component.html'
})
export class ActivityComponent {
  private readonly people = inject(PeopleService);
  private readonly toast = inject(ToastService);

  readonly likedBy = signal<ProfileActivity[]>([]);
  readonly views = signal<ProfileActivity[]>([]);
  readonly loading = signal(true);

  constructor() { void this.load(); }

  async load(): Promise<void> {
    try {
      const [likedBy, views] = await Promise.all([this.people.likedBy(), this.people.profileViews()]);
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
