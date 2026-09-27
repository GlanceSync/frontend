import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { AuthService } from '../../core/services/auth/auth.service';
import { PeopleService } from '../../core/services/people/people.service';
import { DateEvent } from '../../core/interfaces/event/DateEvent';
import { Person } from '../../core/interfaces/user/Person';

@Component({
  selector: 'app-events',
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './events.component.html'
})
export class EventsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly people = inject(PeopleService);
  private readonly auth = inject(AuthService);

  readonly events = signal<DateEvent[]>([]);
  readonly candidates = signal<Person[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly saving = signal(false);

  readonly upcoming = computed(() =>
    this.events().filter(event => new Date(event.startsAt).getTime() >= Date.now())
  );
  readonly past = computed(() =>
    this.events().filter(event => new Date(event.startsAt).getTime() < Date.now())
  );

  readonly form = this.fb.nonNullable.group({
    inviteeId: ['', [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(120)]],
    location: ['', [Validators.maxLength(160)]],
    startsAt: ['', [Validators.required]]
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [events, people] = await Promise.all([this.people.events(), this.people.list()]);
      this.events.set(events);
      this.candidates.set(people);
    } catch (error) {
      this.error.set(AuthService.toApiError(error).message);
    } finally {
      this.loading.set(false);
    }
  }

  isOrganizer(event: DateEvent): boolean {
    return event.organizerId === this.auth.currentUser()?.id;
  }

  /** Only the invitee answers, and only while it is still pending. */
  canAnswer(event: DateEvent): boolean {
    return event.status === 'pending' && !this.isOrganizer(event);
  }

  canCancel(event: DateEvent): boolean {
    return event.status === 'pending' || event.status === 'accepted';
  }

  otherPerson(event: DateEvent): string {
    return this.isOrganizer(event) ? event.inviteeUsername : event.organizerUsername;
  }

  async submit(): Promise<void> {
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    try {
      const raw = this.form.getRawValue();
      await this.people.proposeEvent({
        inviteeId: Number(raw.inviteeId),
        title: raw.title.trim(),
        location: raw.location.trim(),
        // datetime-local has no timezone, so it is read as local time and sent as UTC.
        startsAt: new Date(raw.startsAt).toISOString()
      });
      this.form.reset({ inviteeId: '', title: '', location: '', startsAt: '' });
      await this.load();
    } catch (error) {
      this.formError.set(AuthService.toApiError(error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async respond(event: DateEvent, action: 'accept' | 'decline' | 'cancel'): Promise<void> {
    this.error.set(null);
    try {
      const updated = await this.people.respondToEvent(event.id, action);
      this.events.update(current =>
        current.map(item => (item.id === updated.id ? updated : item))
      );
    } catch (error) {
      this.error.set(AuthService.toApiError(error).message);
    }
  }

  whenLabel(iso: string): string {
    return new Date(iso).toLocaleString([], {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
