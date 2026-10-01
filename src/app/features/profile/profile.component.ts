import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';
import { ProfileService } from '../../core/services/profile/profile.service';
import { PictureService } from '../../core/services/picture/picture.service';
import { InterestService } from '../../core/services/interest/interest.service';
import { Account, Interest, Picture, Profile } from '../../core/interfaces/user/Profile';
import { ToastService } from '../../core/services/toast/toast.service';
import { GeoError, GeolocationService } from '../../core/services/geo/geolocation.service';
import { CitySearchResult, GeocodingService } from '../../core/services/geo/geocoding.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

const AVATAR_SIZE = 512;
const GALLERY_SIZE = 1200;
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

type PhotoTarget = 'avatar' | 'gallery';
type PhotoFilter = 'none' | 'warm' | 'cool' | 'mono' | 'vivid';

interface CitySearchResult {
  place_id: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, DecimalPipe, AvatarComponent, IconComponent],
  templateUrl: './profile.component.html'
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfileService);
  private readonly pictures = inject(PictureService);
  private readonly interests = inject(InterestService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly geo = inject(GeolocationService);
  private readonly geocoding = inject(GeocodingService);

  readonly user = this.auth.currentUser;
  readonly profile = signal<Profile | null>(null);
  readonly account = signal<Account | null>(null);
  readonly availableInterests = signal<Interest[]>([]);
  readonly selectedInterests = signal<string[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly dragging = signal(false);
  readonly galleryDragging = signal(false);
  readonly locating = signal(false);
  readonly resolvingPlace = signal(false);
  readonly searchingCities = signal(false);
  readonly cityResults = signal<CitySearchResult[]>([]);
  readonly savingMapVisibility = signal(false);
  readonly pending = signal<{ blob: Blob; url: string } | null>(null);
  readonly editorOpen = signal(false);
  readonly editorTarget = signal<PhotoTarget>('gallery');
  readonly editorRotation = signal(0);
  readonly editorZoom = signal(1);
  readonly editorX = signal(0);
  readonly editorY = signal(0);
  readonly editorFilter = signal<PhotoFilter>('none');
  readonly editorSaving = signal(false);
  readonly editorCanvas = viewChild<ElementRef<HTMLCanvasElement>>('editorCanvas');
  readonly onboarding = computed(() => !this.user()?.profileCompleted);
  /** The city whose coordinates came from a search result, so they are only sent with it. */
  private geocodedCity: string | null = null;
  private editorBitmap: ImageBitmap | null = null;
  private readonly citySearchCache = new Map<string, CitySearchResult[]>();
  private lastNominatimRequestAt = 0;

  readonly profileForm = this.fb.nonNullable.group({
    gender: ['', Validators.required],
    sexualPreference: ['BISEXUAL', Validators.required],
    biography: ['', [Validators.required, Validators.maxLength(1000)]],
    birthDate: ['', Validators.required],
    locationSource: ['MANUAL', Validators.required],
    city: ['', [Validators.maxLength(100)]],
    latitude: [null as number | null],
    longitude: [null as number | null],
    accuracy: [null as number | null]
  });

  readonly accountForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email]]
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.discardPending();
      this.closeEditor();
    });
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [profile, account, interests] = await Promise.all([
        this.profiles.myProfile(),
        this.profiles.account(),
        this.interests.interests()
      ]);
      this.profile.set(profile);
      this.account.set(account);
      this.availableInterests.set(interests);
      this.selectedInterests.set([...profile.interests]);
      this.auth.syncProfileState(profile);
      this.profileForm.patchValue({
        gender: profile.gender ?? '',
        sexualPreference: profile.sexualPreference ?? 'BISEXUAL',
        biography: profile.biography ?? '',
        birthDate: profile.birthDate ?? '',
        locationSource: profile.locationSource ?? 'MANUAL',
        city: profile.city ?? '',
        latitude: profile.latitude ?? null,
        longitude: profile.longitude ?? null,
        accuracy: profile.locationAccuracy ?? null
      });
      this.geocodedCity = profile.locationSource === 'MANUAL' && profile.latitude != null ? profile.city ?? null : null;
      this.accountForm.patchValue(account);
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.loading.set(false);
    }
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid || this.busy()) {
      this.profileForm.markAllAsTouched();
      this.toast.error('Complete every required profile field.');
      return;
    }
    const values = this.profileForm.getRawValue();
    const names = this.selectedInterests();
    if (!names.length) {
      this.toast.error('Add at least one interest.');
      return;
    }
    if (names.length > 10) {
      this.toast.error('Choose no more than 10 interests.');
      return;
    }
    if (values.locationSource === 'MANUAL' && !values.city.trim()) {
      this.toast.error('Enter your city or use your current location.');
      return;
    }
    if (values.locationSource === 'GPS' && (values.latitude == null || values.longitude == null)) {
      this.toast.error('Use your current location before saving.');
      return;
    }
    if (!this.profile()?.avatarUrl && !this.pending()) {
      this.toast.error('Add a profile picture to continue.');
      return;
    }
    const wasOnboarding = this.onboarding();

    this.busy.set(true);
    try {
      const pending = this.pending();
      if (pending) {
        await this.auth.uploadAvatar(pending.blob);
        this.discardPending();
      }
      await this.profiles.updateProfile({
        gender: values.gender as 'MALE' | 'FEMALE',
        sexualPreference: values.sexualPreference as 'HETEROSEXUAL' | 'HOMOSEXUAL' | 'BISEXUAL',
        biography: values.biography.trim(),
        birthDate: values.birthDate
      });
      if (values.locationSource === 'GPS') {
        await this.profiles.updateLocation({
          source: 'GPS', latitude: values.latitude!, longitude: values.longitude!,
          accuracy: values.accuracy ?? undefined, city: values.city.trim() || undefined
        });
      } else {
        // A city picked from the search results carries its coordinates, which puts the
        // person on the map; a city typed by hand has none.
        const city = values.city.trim();
        const geocoded = city === this.geocodedCity && values.latitude != null && values.longitude != null;
        await this.profiles.updateLocation({
          source: 'MANUAL', city,
          ...(geocoded ? { latitude: values.latitude!, longitude: values.longitude! } : {})
        });
      }
      await this.interests.replaceInterests(names);
      const updated = await this.profiles.myProfile();
      this.profile.set(updated);
      this.auth.syncProfileState(updated);
      if (updated.completed) {
        this.toast.success(wasOnboarding ? 'Your profile is ready.' : 'Profile updated.');
        if (wasOnboarding) await this.router.navigate(['/discover']);
      } else {
        this.toast.error('Your profile is still missing required information.');
      }
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.busy.set(false);
    }
  }

  interestSelected(name: string): boolean {
    return this.selectedInterests().includes(name);
  }

  toggleInterest(name: string, checked: boolean): void {
    if (checked) {
      if (this.selectedInterests().length >= 10) {
        this.toast.error('You can choose up to 10 interests.');
        return;
      }
      this.selectedInterests.update(current => current.includes(name) ? current : [...current, name]);
    } else {
      this.selectedInterests.update(current => current.filter(item => item !== name));
    }
  }

  async saveAccount(): Promise<void> {
    if (this.accountForm.invalid || this.busy()) {
      this.accountForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    try {
      const account = await this.profiles.updateAccount(this.accountForm.getRawValue());
      this.account.set(account);
      this.toast.success(account.pendingEmail ? 'Check your new email address to confirm it.' : 'Account updated.');
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.busy.set(false);
    }
  }

  async useCurrentLocation(): Promise<void> {
    this.locating.set(true);
    try {
      const fix = await this.geo.locate();
      this.profileForm.patchValue({
        locationSource: 'GPS',
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy
      });
      this.locating.set(false);
      void this.resolvePlace(fix.latitude, fix.longitude, fix.accuracy);
    } catch (error) {
      this.locating.set(false);
      const reason = error instanceof GeoError ? error.message : 'We could not access your location.';
      this.toast.error(`${reason} You can enter a city instead.`);
    }
  }

  async toggleMapVisibility(showOnMap: boolean): Promise<void> {
    this.savingMapVisibility.set(true);
    try {
      this.profile.set(await this.profiles.updateMapVisibility(showOnMap));
      this.toast.success(showOnMap ? 'People can now see you on the map.' : 'You are hidden from the map.');
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.savingMapVisibility.set(false);
    }
  }

  async searchCities(): Promise<void> {
    const query = this.profileForm.controls.city.value.trim();
    if (query.length < 2) {
      this.toast.error('Enter at least two characters to search for a city.');
      return;
    }

    this.searchingCities.set(true);
    try {
      const results = await this.geocoding.searchCities(query);
      this.cityResults.set(results);
      if (!results.length) this.toast.error('No matching cities were found. Try including the country.');
    } catch {
      this.toast.error('City search is unavailable right now. Please try again.');
    } finally {
      this.searchingCities.set(false);
    }
  }

  cityName(result: CitySearchResult): string {
    return GeocodingService.cityName(result);
  }

  selectCity(result: CitySearchResult): void {
    const city = GeocodingService.cityName(result);
    this.profileForm.patchValue({
      locationSource: 'MANUAL',
      city,
      latitude: Number(result.lat),
      longitude: Number(result.lon),
      accuracy: null
    });
    this.geocodedCity = city;
    this.cityResults.set([]);
    this.toast.success(`City selected: ${city}.`);
  }

  private async resolvePlace(latitude: number, longitude: number, accuracy: number): Promise<void> {
    const precision = `accurate to about ${Math.round(accuracy)} m`;
    this.resolvingPlace.set(true);
    try {
      const place = await this.geocoding.placeName(latitude, longitude);
      if (place) {
        this.profileForm.patchValue({ city: place });
        this.toast.success(`Location found: ${place}, ${precision}.`);
      } else {
        this.toast.success(`Current location added, ${precision}. Enter the nearest city if needed.`);
      }
    } catch {
      this.toast.success(`Current location added, ${precision}. Enter the nearest city if needed.`);
    } finally {
      this.resolvingPlace.set(false);
    }
  }

  onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.openEditor(file, 'avatar');
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.openEditor(file, 'avatar');
  }

  onGalleryDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.profile()!.pictures.length < 5) this.galleryDragging.set(true);
  }

  onGalleryDrop(event: DragEvent): void {
    event.preventDefault();
    this.galleryDragging.set(false);
    if (this.profile()!.pictures.length >= 5) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.openEditor(file, 'gallery');
  }

  uploadExtra(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.openEditor(file, 'gallery');
  }

  async makePrimary(picture: Picture): Promise<void> {
    this.busy.set(true);
    try {
      this.updatePictures(await this.pictures.makeProfilePicture(picture.id));
      await this.load();
      this.toast.success('Profile picture changed.');
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.busy.set(false);
    }
  }

  async removePicture(picture: Picture): Promise<void> {
    this.busy.set(true);
    try {
      this.updatePictures(await this.pictures.deletePicture(picture.id));
      await this.load();
      this.toast.success('Photo removed.');
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.busy.set(false);
    }
  }

  cancel(): void { this.discardPending(); }

  private updatePictures(pictures: Picture[]): void {
    this.profile.update(profile => profile ? { ...profile, pictures } : profile);
  }

  private validImage(file: File): boolean {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.toast.error('Choose a JPEG, PNG or WebP image.');
      return false;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      this.toast.error('Choose an image under 5 MB.');
      return false;
    }
    return true;
  }

  async openEditor(file: File, target: PhotoTarget): Promise<void> {
    if (!this.validImage(file)) return;
    try {
      this.editorBitmap?.close();
      this.editorBitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      this.toast.error('That image could not be read.');
      return;
    }
    this.editorTarget.set(target);
    this.editorRotation.set(0);
    this.editorZoom.set(1);
    this.editorX.set(0);
    this.editorY.set(0);
    this.editorFilter.set('none');
    this.editorOpen.set(true);
    setTimeout(() => this.renderEditor());
  }

  updateEditor(): void { this.renderEditor(); }

  rotateEditor(direction: -1 | 1): void {
    this.editorRotation.update(value => (value + direction * 90 + 360) % 360);
    this.renderEditor();
  }

  async applyEditor(): Promise<void> {
    const bitmap = this.editorBitmap;
    if (!bitmap || this.editorSaving()) return;
    this.editorSaving.set(true);
    try {
      const size = this.editorTarget() === 'avatar' ? AVATAR_SIZE : GALLERY_SIZE;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      this.drawEditedImage(canvas, bitmap);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Could not create the edited image.');

      if (this.editorTarget() === 'avatar') {
        this.discardPending();
        this.pending.set({ blob, url: URL.createObjectURL(blob) });
        this.closeEditor();
      } else {
        this.updatePictures(await this.pictures.uploadPicture(blob));
        this.closeEditor();
        this.toast.success('Photo added to your gallery.');
      }
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.editorSaving.set(false);
    }
  }

  closeEditor(): void {
    this.editorBitmap?.close();
    this.editorBitmap = null;
    this.editorOpen.set(false);
  }

  private renderEditor(): void {
    const canvas = this.editorCanvas()?.nativeElement;
    const bitmap = this.editorBitmap;
    if (canvas && bitmap) this.drawEditedImage(canvas, bitmap);
  }

  private drawEditedImage(canvas: HTMLCanvasElement, bitmap: ImageBitmap): void {
    const context = canvas.getContext('2d')!;
    const size = canvas.width;
    const quarterTurn = this.editorRotation() % 180 !== 0;
    const rotatedWidth = quarterTurn ? bitmap.height : bitmap.width;
    const rotatedHeight = quarterTurn ? bitmap.width : bitmap.height;
    const scale = Math.max(size / rotatedWidth, size / rotatedHeight) * this.editorZoom();
    const overflowX = Math.max(0, rotatedWidth * scale - size);
    const overflowY = Math.max(0, rotatedHeight * scale - size);

    context.save();
    context.clearRect(0, 0, size, size);
    context.fillStyle = '#111';
    context.fillRect(0, 0, size, size);
    context.filter = this.canvasFilter(this.editorFilter());
    context.translate(
      size / 2 + (this.editorX() / 100) * overflowX / 2,
      size / 2 + (this.editorY() / 100) * overflowY / 2
    );
    context.rotate(this.editorRotation() * Math.PI / 180);
    context.scale(scale, scale);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    context.restore();
  }

  private canvasFilter(filter: PhotoFilter): string {
    switch (filter) {
      case 'warm': return 'sepia(.22) saturate(1.2) brightness(1.04)';
      case 'cool': return 'saturate(.9) hue-rotate(175deg) hue-rotate(180deg)';
      case 'mono': return 'grayscale(1) contrast(1.08)';
      case 'vivid': return 'saturate(1.45) contrast(1.08)';
      default: return 'none';
    }
  }

  private discardPending(): void {
    const pending = this.pending();
    if (pending) URL.revokeObjectURL(pending.url);
    this.pending.set(null);
  }
}
