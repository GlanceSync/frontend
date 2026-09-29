import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DiscoveryService } from '../../core/services/discovery/discovery.service';
import { ProfileService } from '../../core/services/profile/profile.service';
import { InterestService } from '../../core/services/interest/interest.service';
import { ActivityService } from '../../core/services/activity/activity.service';
import { DiscoveryCard, DiscoveryPreferences, Interest, Profile } from '../../core/interfaces/user/Profile';
import { ToastService } from '../../core/services/toast/toast.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-discover',
  imports: [RouterLink, ReactiveFormsModule, IconComponent],
  templateUrl: './discover.component.html'
})
export class DiscoverComponent {
  private readonly discovery = inject(DiscoveryService);
  private readonly profiles = inject(ProfileService);
  private readonly interests = inject(InterestService);
  private readonly activity = inject(ActivityService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  private readonly candidates = signal<DiscoveryCard[]>([]);
  private readonly index = signal(0);
  private pointerStartX = 0;
  private pointerId: number | null = null;

  readonly profile = signal<Profile | null>(null);
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly dragX = signal(0);
  readonly dragging = signal(false);
  readonly photoIndex = signal(0);
  readonly preferencesOpen = signal(false);
  readonly preferencesLoading = signal(false);
  readonly preferencesSaving = signal(false);
  readonly availableInterests = signal<Interest[]>([]);
  readonly preferenceTags = signal<string[]>([]);

  readonly preferencesForm = this.fb.nonNullable.group({
    minAge: [''],
    maxAge: [''],
    minFame: [''],
    maxFame: [''],
    distance: [''],
    city: [''],
    sort: [''],
    order: ['ASC']
  });

  readonly cardTransform = computed(() => {
    const x = this.dragX();
    return `translateX(${x}px) rotate(${x / 24}deg)`;
  });
  readonly cardOpacity = computed(() => Math.max(0.35, 1 - Math.abs(this.dragX()) / 450));
  readonly decision = computed<'like' | 'pass' | null>(() =>
    this.dragX() > 45 ? 'like' : this.dragX() < -45 ? 'pass' : null
  );
  readonly currentPhoto = computed(() => {
    const pictures = this.profile()?.pictures ?? [];
    return pictures[this.photoIndex()]?.url ?? this.profile()?.avatarUrl ?? '';
  });

  constructor() {
    void this.loadDeck();
    void this.loadPreferenceData();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') void this.pass();
    if (event.key === 'ArrowRight') void this.like();
  }

  async loadDeck(): Promise<void> {
    this.loading.set(true);
    try {
      this.candidates.set(await this.discovery.discover());
      this.index.set(0);
      await this.loadCurrent();
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.loading.set(false);
    }
  }

  async openPreferences(): Promise<void> {
    this.preferencesOpen.set(true);
    if (!this.availableInterests().length) await this.loadPreferenceData();
  }

  closePreferences(): void {
    if (!this.preferencesSaving()) this.preferencesOpen.set(false);
  }

  preferenceTagSelected(name: string): boolean {
    return this.preferenceTags().includes(name);
  }

  togglePreferenceTag(name: string, checked: boolean): void {
    this.preferenceTags.update(current => checked
      ? (current.includes(name) ? current : [...current, name])
      : current.filter(tag => tag !== name));
  }

  async savePreferences(): Promise<void> {
    const value = this.preferencesForm.getRawValue();
    const minAge = this.numberOrNull(value.minAge);
    const maxAge = this.numberOrNull(value.maxAge);
    if (minAge != null && maxAge != null && minAge > maxAge) {
      this.toast.error('Minimum age cannot be greater than maximum age.');
      return;
    }
    const minFame = this.numberOrNull(value.minFame);
    const maxFame = this.numberOrNull(value.maxFame);
    if (minFame != null && maxFame != null && minFame > maxFame) {
      this.toast.error('Minimum fame cannot be greater than maximum fame.');
      return;
    }

    this.preferencesSaving.set(true);
    try {
      const saved = await this.discovery.saveDiscoveryPreferences({
        minAge, maxAge, minFame, maxFame,
        distance: this.numberOrNull(value.distance),
        city: value.city.trim() || null,
        tags: this.preferenceTags(),
        sort: value.sort || null,
        order: value.sort ? value.order : null
      });
      this.applyPreferences(saved);
      this.preferencesOpen.set(false);
      this.toast.success('Discovery preferences saved.');
      await this.loadDeck();
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.preferencesSaving.set(false);
    }
  }

  async pass(): Promise<void> {
    if (!this.profile() || this.acting()) return;
    this.acting.set(true);
    this.dragX.set(-520);
    await this.delay(180);
    await this.advance();
  }

  async like(): Promise<void> {
    const profile = this.profile();
    if (!profile || this.acting()) return;
    this.acting.set(true);
    try {
      const state = await this.activity.like(profile.id);
      this.dragX.set(520);
      if (state.connected) this.toast.success(`You matched with ${profile.firstName}!`);
      await this.delay(180);
      await this.advance();
    } catch (error) {
      this.dragX.set(0);
      this.acting.set(false);
      this.toast.apiError(error);
    }
  }

  onPointerDown(event: PointerEvent): void {
    if (this.acting()) return;
    this.pointerId = event.pointerId;
    this.pointerStartX = event.clientX;
    this.dragging.set(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging() || this.pointerId !== event.pointerId) return;
    this.dragX.set(event.clientX - this.pointerStartX);
  }

  onPointerUp(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    const distance = this.dragX();
    this.dragging.set(false);
    this.pointerId = null;
    if (distance >= 90) void this.like();
    else if (distance <= -90) void this.pass();
    else this.dragX.set(0);
  }

  previousPhoto(event: Event): void {
    event.stopPropagation();
    const count = this.profile()?.pictures.length ?? 0;
    if (count > 1) this.photoIndex.update(value => (value - 1 + count) % count);
  }

  nextPhoto(event: Event): void {
    event.stopPropagation();
    const count = this.profile()?.pictures.length ?? 0;
    if (count > 1) this.photoIndex.update(value => (value + 1) % count);
  }

  private async advance(): Promise<void> {
    this.index.update(value => value + 1);
    this.dragX.set(0);
    this.photoIndex.set(0);
    await this.loadCurrent();
    this.acting.set(false);
  }

  private async loadCurrent(): Promise<void> {
    while (this.index() < this.candidates().length) {
      const candidate = this.candidates()[this.index()];
      const id = candidate.id ?? candidate.userId;
      if (!id) {
        this.index.update(value => value + 1);
        continue;
      }
      try {
        this.profile.set(await this.profiles.profile(id));
        return;
      } catch {
        this.index.update(value => value + 1);
      }
    }
    this.profile.set(null);
  }

  private async loadPreferenceData(): Promise<void> {
    this.preferencesLoading.set(true);
    try {
      const [preferences, interests] = await Promise.all([
        this.discovery.discoveryPreferences(),
        this.interests.interests()
      ]);
      this.availableInterests.set(interests);
      this.applyPreferences(preferences);
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.preferencesLoading.set(false);
    }
  }

  private applyPreferences(preferences: DiscoveryPreferences): void {
    this.preferencesForm.setValue({
      minAge: preferences.minAge == null ? '' : String(preferences.minAge),
      maxAge: preferences.maxAge == null ? '' : String(preferences.maxAge),
      minFame: preferences.minFame == null ? '' : String(preferences.minFame),
      maxFame: preferences.maxFame == null ? '' : String(preferences.maxFame),
      distance: preferences.distance == null ? '' : String(preferences.distance),
      city: preferences.city ?? '',
      sort: preferences.sort ?? '',
      order: preferences.order ?? 'ASC'
    });
    this.preferenceTags.set(preferences.tags ?? []);
  }

  private numberOrNull(value: string): number | null {
    if (!value.trim()) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }
}
