import {
  Component, DestroyRef, ElementRef, NgZone, afterNextRender, computed, effect, inject, signal, viewChild
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type * as Leaflet from 'leaflet';
import { MapService } from '../../core/services/map/map.service';
import { ProfileService } from '../../core/services/profile/profile.service';
import { GeoError, GeoFix, GeolocationService } from '../../core/services/geo/geolocation.service';
import { GeocodingService } from '../../core/services/geo/geocoding.service';
import { ToastService } from '../../core/services/toast/toast.service';
import { MapUser } from '../../core/interfaces/map/MapUser';
import { Profile } from '../../core/interfaces/user/Profile';
import { avatarHue } from '../../core/utils/avatar-hue.util';
import { IconComponent } from '../../shared/components/icon/icon.component';

type LeafletModule = typeof Leaflet;

/** Below this a new GPS fix is the same place, and not worth saving over the old one. */
const MOVED_METERS = 100;
const STREET_ZOOM = 14;

/**
 * Everyone sharing their location, on an OpenStreetMap map. Leaflet needs a real DOM, so
 * it is loaded only in the browser, after the first render; the server renders the frame.
 */
@Component({
  selector: 'app-map',
  imports: [RouterLink, IconComponent],
  templateUrl: './map.component.html'
})
export class MapComponent {
  private readonly mapService = inject(MapService);
  private readonly profiles = inject(ProfileService);
  private readonly geo = inject(GeolocationService);
  private readonly geocoding = inject(GeocodingService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly canvas = viewChild.required<ElementRef<HTMLDivElement>>('canvas');

  readonly people = signal<MapUser[]>([]);
  readonly onlineOnly = signal(false);
  readonly loading = signal(true);
  readonly locating = signal(false);
  readonly locationNotice = signal<string | null>(null);

  readonly shown = computed(() => this.onlineOnly() ? this.people().filter(person => person.online) : this.people());
  readonly summary = computed(() => {
    const total = this.people().length;
    const count = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;
    const text = this.onlineOnly()
      ? `${this.shown().length} online of ${count(total)} in this area`
      : `${count(total)} in this area`;
    return total >= MapService.MAX_MARKERS ? `${text} · zoom in to see everyone` : text;
  });

  private L?: LeafletModule;
  private map?: Leaflet.Map;
  private cluster?: Leaflet.MarkerClusterGroup;
  private meLayer?: Leaflet.LayerGroup;
  private profile: Profile | null = null;
  private fix: GeoFix | null = null;
  private fetchSeq = 0;
  private moveTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  constructor() {
    afterNextRender(() => void this.init());
    effect(() => this.renderMarkers(this.shown()));
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      clearTimeout(this.moveTimer);
      this.map?.remove();
    });
  }

  recenter(): void {
    if (this.fix) {
      this.map?.flyTo([this.fix.latitude, this.fix.longitude], Math.max(this.map.getZoom(), STREET_ZOOM));
    } else {
      void this.locateMe(true);
    }
  }

  toggleOnlineOnly(): void {
    this.onlineOnly.update(value => !value);
  }

  private async init(): Promise<void> {
    const [leaflet, profile] = await Promise.all([
      import('leaflet'),
      this.profiles.myProfile().catch(() => null)
    ]);
    // The plugin attaches itself to the global L that Leaflet's bundle sets, which is the
    // module's default export rather than its namespace copy.
    const L = ((leaflet as unknown as { default?: LeafletModule }).default ?? leaflet) as LeafletModule;
    await import('leaflet.markercluster');
    if (this.destroyed) return;

    this.L = L;
    this.profile = profile;
    const saved = this.savedPosition();

    // Leaflet fires events on every pointer move; keeping them out of Angular's zone stops
    // each one from running change detection. Handlers step back in when they update state.
    this.zone.runOutsideAngular(() => {
      const map = L.map(this.canvas().nativeElement, {
        zoomControl: false,
        minZoom: 2,
        maxBounds: [[-90, -180], [90, 180]],
        maxBoundsViscosity: 1
      });
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        noWrap: true,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      this.cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 48 });
      map.addLayer(this.cluster);
      this.meLayer = L.layerGroup().addTo(map);

      if (saved) {
        map.setView([saved.latitude, saved.longitude], 12);
      } else {
        map.setView([20, 0], 2);
      }
      map.on('moveend', () => this.zone.run(() => this.scheduleFetch()));
      this.map = map;
    });

    if (saved) this.showMe(saved.latitude, saved.longitude, profile?.locationAccuracy ?? null);
    this.renderMarkers(this.shown());
    void this.fetchPeople();
    void this.locateMe(false);
  }

  private async locateMe(userAsked: boolean): Promise<void> {
    this.locating.set(true);
    try {
      const fix = await this.geo.locate();
      if (this.destroyed) return;
      this.fix = fix;
      this.locationNotice.set(null);
      this.showMe(fix.latitude, fix.longitude, fix.accuracy);

      const saved = this.savedPosition();
      if (userAsked || !saved || GeolocationService.distanceMeters(saved, fix) > MOVED_METERS * 5) {
        this.map?.flyTo([fix.latitude, fix.longitude], Math.max(this.map.getZoom(), STREET_ZOOM));
      }
      void this.saveFix(fix);
    } catch (error) {
      if (this.destroyed) return;
      const saved = this.savedPosition();
      const denied = error instanceof GeoError && error.reason === 'denied';
      this.locationNotice.set(saved
        ? (denied ? 'Location is off, so the map is using the location saved in your profile.'
                  : 'We could not find your current position, so the map is using your saved location.')
        : 'Turn on location, or set your city in your profile, to see people near you.');
      if (userAsked && saved) this.map?.flyTo([saved.latitude, saved.longitude], STREET_ZOOM);
    } finally {
      this.locating.set(false);
    }
  }

  /**
   * Keeps the saved location in step with where the person really is, so distances stay
   * right for everyone. A city chosen by hand is a deliberate choice and is left alone.
   */
  private async saveFix(fix: GeoFix): Promise<void> {
    const profile = this.profile;
    if (!profile || profile.locationSource === 'MANUAL') return;

    const saved = this.savedPosition();
    const moved = !saved || GeolocationService.distanceMeters(saved, fix) > MOVED_METERS;
    const sharper = fix.accuracy < (profile.locationAccuracy ?? Infinity);
    if (!moved && !sharper) return;

    try {
      const city = moved ? await this.geocoding.placeName(fix.latitude, fix.longitude).catch(() => null) : null;
      this.profile = await this.profiles.updateLocation({
        source: 'GPS',
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
        city: city ?? profile.city ?? undefined
      });
    } catch {
      // The map works without it; the next visit tries again.
    }
  }

  private savedPosition(): { latitude: number; longitude: number } | null {
    const profile = this.profile;
    return profile?.latitude != null && profile.longitude != null
      ? { latitude: profile.latitude, longitude: profile.longitude }
      : null;
  }

  private scheduleFetch(): void {
    clearTimeout(this.moveTimer);
    this.moveTimer = setTimeout(() => void this.fetchPeople(), 300);
  }

  private async fetchPeople(): Promise<void> {
    if (!this.map) return;
    const bounds = this.map.getBounds();
    const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
    const seq = ++this.fetchSeq;
    this.loading.set(true);
    try {
      const people = await this.mapService.inBounds({
        minLat: clamp(bounds.getSouth(), 90),
        minLng: clamp(bounds.getWest(), 180),
        maxLat: clamp(bounds.getNorth(), 90),
        maxLng: clamp(bounds.getEast(), 180)
      });
      // Panning quickly can leave an older, slower response behind a newer one.
      if (seq === this.fetchSeq) this.people.set(people);
    } catch (error) {
      if (seq === this.fetchSeq) this.toast.apiError(error);
    } finally {
      if (seq === this.fetchSeq) this.loading.set(false);
    }
  }

  private showMe(latitude: number, longitude: number, accuracy: number | null): void {
    const L = this.L;
    if (!L || !this.meLayer) return;
    this.meLayer.clearLayers();
    if (accuracy != null) {
      L.circle([latitude, longitude], { radius: accuracy, className: 'map-me-accuracy', interactive: false })
        .addTo(this.meLayer);
    }
    L.circleMarker([latitude, longitude], { radius: 8, className: 'map-me', weight: 3, fillOpacity: 1 })
      .bindTooltip(accuracy != null ? `You · accurate to ${Math.round(accuracy)} m` : 'You')
      .addTo(this.meLayer);
  }

  private renderMarkers(people: MapUser[]): void {
    const L = this.L;
    const cluster = this.cluster;
    if (!L || !cluster) return;
    cluster.clearLayers();
    cluster.addLayers(people.map(person =>
      L.marker([person.latitude, person.longitude], {
        icon: this.avatarIcon(L, person),
        title: person.firstName,
        alt: `${person.firstName} on the map`
      }).bindPopup(() => this.popup(person), { maxWidth: 260, className: 'map-popup-wrapper' })
    ));
  }

  // Markers and popups are built from DOM nodes rather than HTML strings, so a name can
  // never be read as markup.

  private avatarIcon(L: LeafletModule, person: MapUser): Leaflet.DivIcon {
    const avatar = this.avatar(person, 'map-avatar');
    if (person.online) avatar.classList.add('is-online');
    return L.divIcon({ html: avatar, className: 'map-avatar-icon', iconSize: [44, 44], iconAnchor: [22, 22],
      popupAnchor: [0, -22] });
  }

  private popup(person: MapUser): HTMLElement {
    const root = element('div', 'map-popup');

    const head = element('div', 'map-popup-head');
    head.append(this.avatar(person, 'map-popup-avatar'));
    const who = element('div');
    who.append(element('strong', '', person.age != null ? `${person.firstName}, ${person.age}` : person.firstName));
    const status = [person.online ? 'Online' : 'Offline'];
    if (person.distanceKm != null) {
      status.push(person.distanceKm < 1 ? 'less than 1 km away' : `${person.distanceKm} km away`);
    }
    who.append(element('span', person.online ? 'map-popup-meta is-online' : 'map-popup-meta', status.join(' · ')));
    head.append(who);
    root.append(head);

    if (person.commonInterests.length) {
      const tags = element('div', 'map-popup-tags');
      person.commonInterests.slice(0, 4).forEach(name => tags.append(element('span', 'map-popup-tag', `#${name}`)));
      root.append(tags);
    }

    const link = element('a', 'map-popup-link', 'View profile') as HTMLAnchorElement;
    link.href = `/profile/${person.id}`;
    link.addEventListener('click', event => {
      event.preventDefault();
      this.zone.run(() => void this.router.navigate(['/profile', person.id]));
    });
    root.append(link);
    return root;
  }

  private avatar(person: MapUser, className: string): HTMLElement {
    const avatar = element('div', className);
    avatar.style.setProperty('--avatar-hue', String(avatarHue(person.username)));
    const initial = (person.firstName || person.username || '?').charAt(0).toUpperCase();
    if (person.avatarUrl) {
      const img = element('img') as HTMLImageElement;
      img.src = person.avatarUrl;
      img.alt = '';
      img.draggable = false;
      img.addEventListener('error', () => img.replaceWith(initial));
      avatar.append(img);
    } else {
      avatar.textContent = initial;
    }
    return avatar;
  }
}

function element(tag: string, className = '', text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
