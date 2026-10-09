import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DiscoveryCard } from '../../../core/interfaces/user/Profile';
import { AvatarComponent } from '../avatar/avatar.component';

/**
 * People as a grid of tiles. Everything shown comes from the list itself; only following
 * a tile to the full profile counts as a visit.
 */
@Component({
  selector: 'app-profile-grid',
  imports: [RouterLink, AvatarComponent],
  template: `
    <ul class="profile-grid">
      @for (person of people(); track person.id) {
        <li>
          <a class="profile-tile" [routerLink]="['/profile', person.id]">
            <div class="profile-tile-photo">
              @if (person.avatarUrl) {
                <img [src]="person.avatarUrl" [alt]="person.firstName + ' profile photo'" loading="lazy" />
              } @else {
                <app-avatar class="avatar-xl" [name]="person.username" />
              }
              @if (person.online) { <span class="profile-tile-online">Online</span> }
            </div>
            <div class="profile-tile-body">
              <h3>{{ person.firstName }}@if (person.age != null) {, {{ person.age }}}</h3>
              <p class="profile-tile-place">
                {{ person.city || 'Somewhere' }}
                @if (person.distanceKm != null) { · {{ person.distanceKm }} km }
              </p>
              <dl class="profile-tile-stats">
                <div><dt>Fame</dt><dd>{{ person.fameRating }}</dd></div>
                <div><dt>In common</dt><dd>{{ person.commonTags }}</dd></div>
              </dl>
              <div class="interest-list">
                @for (interest of person.interests.slice(0, 3); track interest) {
                  <span class="interest-chip">{{ interest }}</span>
                }
                @if (person.interests.length > 3) {
                  <span class="interest-chip">+{{ person.interests.length - 3 }}</span>
                }
              </div>
            </div>
          </a>
        </li>
      }
    </ul>
  `
})
export class ProfileGridComponent {
  readonly people = input.required<DiscoveryCard[]>();
}
