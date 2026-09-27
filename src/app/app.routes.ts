import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'chat' },
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
  // The conversation list is the shell; a thread is a child of it, so the list stays
  // mounted and only the right-hand pane changes as you move between conversations.
  {
    path: 'chat',
    canActivate: [authGuard],
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
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/notifications/notifications.component').then(m => m.NotificationsComponent),
    title: 'Notifications · GlanceSync'
  },
  {
    path: 'events',
    canActivate: [authGuard],
    loadComponent: () => import('./features/events/events.component').then(m => m.EventsComponent),
    title: 'Dates · GlanceSync'
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
    title: 'Profile · GlanceSync'
  },
  { path: '**', redirectTo: 'chat' }
];
