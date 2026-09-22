import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'chat' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
    title: 'Sign in · GlanceSync'
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent),
    title: 'Create account · GlanceSync'
  },
  // The conversation list is the shell; a thread is a child of it, so the list stays
  // mounted and only the right-hand pane changes as you move between conversations.
  {
    path: 'chat',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/messenger/messenger.component').then(m => m.MessengerComponent),
    title: 'Chats · GlanceSync',
    children: [
      {
        path: ':id',
        loadComponent: () => import('./pages/chat/chat.component').then(m => m.ChatComponent)
      }
    ]
  },
  { path: 'users', pathMatch: 'full', redirectTo: 'chat' },
  {
    path: 'notifications',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent),
    title: 'Notifications · GlanceSync'
  },
  {
    path: 'events',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/events/events.component').then(m => m.EventsComponent),
    title: 'Dates · GlanceSync'
  },
  { path: '**', redirectTo: 'chat' }
];
