import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DiscoveryQuery, DiscoveryService } from '../../core/services/discovery/discovery.service';
import { InterestService } from '../../core/services/interest/interest.service';
import { DiscoveryCard, Interest } from '../../core/interfaces/user/Profile';
import { ToastService } from '../../core/services/toast/toast.service';
import { ProfileGridComponent } from '../../shared/components/profile-grid/profile-grid.component';
import { SortBarComponent, SortChange } from '../../shared/components/sort-bar/sort-bar.component';

const SEARCH_PAGE_SIZE = 24;

/**
 * Advanced search. Unlike Discover it ignores the saved preferences: only the criteria
 * picked here apply. Changing the sort or the criteria runs the search again.
 */
@Component({
  selector: 'app-search',
  imports: [ReactiveFormsModule, ProfileGridComponent, SortBarComponent],
  templateUrl: './search.component.html'
})
export class SearchComponent {
  private readonly discovery = inject(DiscoveryService);
  private readonly interests = inject(InterestService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  /** The criteria of the search on screen; the sort bar and "Show more" reuse them. */
  private query: DiscoveryQuery | null = null;

  readonly form = this.fb.nonNullable.group({
    minAge: [''],
    maxAge: [''],
    minFame: [''],
    maxFame: [''],
    city: [''],
    distance: ['']
  });
  readonly availableInterests = signal<Interest[]>([]);
  readonly tags = signal<string[]>([]);
  readonly sort = signal<string | null>(null);
  readonly order = signal<string | null>(null);

  readonly results = signal<DiscoveryCard[] | null>(null);
  readonly searching = signal(false);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(false);

  constructor() {
    void this.loadInterests();
  }

  tagSelected(name: string): boolean {
    return this.tags().includes(name);
  }

  toggleTag(name: string, checked: boolean): void {
    this.tags.update(current => checked
      ? (current.includes(name) ? current : [...current, name])
      : current.filter(tag => tag !== name));
  }

  async search(): Promise<void> {
    const query = this.readCriteria();
    if (!query) return;
    this.query = query;
    await this.run();
  }

  async changeSort(change: SortChange): Promise<void> {
    this.sort.set(change.sort);
    this.order.set(change.order);
    if (this.query) await this.run();
  }

  async loadMore(): Promise<void> {
    const current = this.results();
    if (!this.query || !current || this.loadingMore()) return;
    this.loadingMore.set(true);
    try {
      const page = await this.discovery.search(this.page(current.length));
      this.results.set([...current, ...page]);
      this.hasMore.set(page.length === SEARCH_PAGE_SIZE);
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.loadingMore.set(false);
    }
  }

  reset(): void {
    this.form.reset();
    this.tags.set([]);
    this.sort.set(null);
    this.order.set(null);
    this.query = null;
    this.results.set(null);
    this.hasMore.set(false);
  }

  private async run(): Promise<void> {
    this.searching.set(true);
    try {
      const page = await this.discovery.search(this.page(0));
      this.results.set(page);
      this.hasMore.set(page.length === SEARCH_PAGE_SIZE);
    } catch (error) {
      this.toast.apiError(error);
    } finally {
      this.searching.set(false);
    }
  }

  private page(offset: number): DiscoveryQuery {
    return { ...this.query, sort: this.sort(), order: this.order(), limit: SEARCH_PAGE_SIZE, offset };
  }

  /** The criteria from the form, or null (with a message) when they cannot be searched. */
  private readCriteria(): DiscoveryQuery | null {
    const value = this.form.getRawValue();
    const minAge = this.numberOrNull(value.minAge);
    const maxAge = this.numberOrNull(value.maxAge);
    const minFame = this.numberOrNull(value.minFame);
    const maxFame = this.numberOrNull(value.maxFame);
    const distance = this.numberOrNull(value.distance);
    const city = value.city.trim();
    const tags = this.tags();

    if ([minAge, maxAge, minFame, maxFame, distance].some(number => Number.isNaN(number))) {
      this.toast.error('Use numbers for ages, fame and distance.');
      return null;
    }
    if ((minAge != null && minAge < 18) || (maxAge != null && maxAge < 18)) {
      this.toast.error('Ages start at 18.');
      return null;
    }
    if (minAge != null && maxAge != null && minAge > maxAge) {
      this.toast.error('The minimum age cannot be above the maximum.');
      return null;
    }
    if ((minFame != null && minFame < 0) || (maxFame != null && maxFame < 0)) {
      this.toast.error('Fame ratings start at 0.');
      return null;
    }
    if (minFame != null && maxFame != null && minFame > maxFame) {
      this.toast.error('The minimum fame rating cannot be above the maximum.');
      return null;
    }
    if (distance != null && distance <= 0) {
      this.toast.error('The distance must be more than 0 km.');
      return null;
    }
    if (minAge == null && maxAge == null && minFame == null && maxFame == null
      && distance == null && !city && !tags.length) {
      this.toast.error('Pick at least one criterion to search by.');
      return null;
    }
    return { minAge, maxAge, minFame, maxFame, distance, city: city || null, tags };
  }

  /** null for an empty field, NaN for one that is not a number. */
  private numberOrNull(value: string): number | null {
    return value.trim() ? Number(value) : null;
  }

  private async loadInterests(): Promise<void> {
    try {
      this.availableInterests.set(await this.interests.interests());
    } catch (error) {
      this.toast.apiError(error);
    }
  }
}
