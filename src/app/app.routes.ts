import { Routes } from '@angular/router';
import { guestGuard } from './core/guards/guest.guard';
import { incompleteProfileGuard, profileCompleteGuard } from './core/guards/profile-complete.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'discover' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
    title: 'Sign in · GlanceSync'
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent),
    title: 'Create account · GlanceSync'
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    title: 'Forgot password · GlanceSync'
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    title: 'Reset password · GlanceSync'
  },
  {
    path: 'auth/:provider/callback',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/oauth-callback/oauth-callback.component').then(m => m.OAuthCallbackComponent),
    title: 'Signing in · GlanceSync'
  },
  {
    path: 'complete-profile',
    canActivate: [incompleteProfileGuard],
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
    title: 'Complete your profile · GlanceSync'
  },
  // The conversation list is the shell; a thread is a child of it, so the list stays
  // mounted and only the right-hand pane changes as you move between conversations.
  {
    path: 'discover',
    canActivate: [profileCompleteGuard],
    loadComponent: () => import('./features/discover/discover.component').then(m => m.DiscoverComponent),
    title: 'Discover · GlanceSync'
  },
  {
    path: 'search',
    canActivate: [profileCompleteGuard],
    loadComponent: () => import('./features/search/search.component').then(m => m.SearchComponent),
    title: 'Search · GlanceSync'
  },
  {
    path: 'map',
    canActivate: [profileCompleteGuard],
    loadComponent: () => import('./features/map/map.component').then(m => m.MapComponent),
    title: 'Map · GlanceSync'
  },
  {
    path: 'chat',
    canActivate: [profileCompleteGuard],
    loadComponent: () =>
      import('./features/messenger/messenger.component').then(m => m.MessengerComponent),
    title: 'Chats · GlanceSync',
    children: [
      {
        path: ':id',
        loadComponent: () => import('./features/chat/chat.component').then(m => m.ChatComponent)
      }
    ]
  },
  { path: 'users', pathMatch: 'full', redirectTo: 'chat' },
  {
    path: 'notifications',
    canActivate: [profileCompleteGuard],
    loadComponent: () =>
      import('./features/notifications/notifications.component').then(m => m.NotificationsComponent),
    title: 'Notifications · GlanceSync'
  },
  {
    path: 'events',
    canActivate: [profileCompleteGuard],
    loadComponent: () => import('./features/events/events.component').then(m => m.EventsComponent),
    title: 'Dates · GlanceSync'
  },
  {
    path: 'profile',
    canActivate: [profileCompleteGuard],
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
    title: 'Profile · GlanceSync'
  },
  {
    path: 'profile/:id',
    canActivate: [profileCompleteGuard],
    loadComponent: () => import('./features/user-profile/user-profile.component').then(m => m.UserProfileComponent),
    title: 'Profile · GlanceSync'
  },
  { path: 'people/:id', redirectTo: 'profile/:id' },
  {
    path: 'activity',
    canActivate: [profileCompleteGuard],
    loadComponent: () => import('./features/activity/activity.component').then(m => m.ActivityComponent),
    title: 'Activity · GlanceSync'
  },
  { path: '**', redirectTo: 'chat' }
];
