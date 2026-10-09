import { Component, input, output } from '@angular/core';
import { SORT_OPTIONS, SortOrder, defaultOrder } from '../../../core/services/discovery/discovery.service';

export interface SortChange {
  sort: string | null;
  order: SortOrder | null;
}

/** Sort and direction for a list of people. Picking a sort also picks its natural direction. */
@Component({
  selector: 'app-sort-bar',
  template: `
    <div class="sort-bar">
      <label>Sort by
        <select (change)="pickSort($any($event.target).value)">
          <option value="" [selected]="!sort()">{{ emptyLabel() }}</option>
          @for (option of options; track option.value) {
            <option [value]="option.value" [selected]="option.value === sort()">{{ option.label }}</option>
          }
        </select>
      </label>
      <label>Order
        <select [disabled]="!sort()" (change)="pickOrder($any($event.target).value)">
          <option value="asc" [selected]="order() !== 'desc'">Ascending</option>
          <option value="desc" [selected]="order() === 'desc'">Descending</option>
        </select>
      </label>
    </div>
  `
})
export class SortBarComponent {
  readonly sort = input<string | null | undefined>(null);
  readonly order = input<string | null | undefined>(null);
  readonly emptyLabel = input('Recommended');
  readonly changed = output<SortChange>();

  protected readonly options = SORT_OPTIONS;

  protected pickSort(sort: string): void {
    this.changed.emit(sort ? { sort, order: defaultOrder(sort) } : { sort: null, order: null });
  }

  protected pickOrder(order: SortOrder): void {
    this.changed.emit({ sort: this.sort() ?? null, order });
  }
}
