import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // Server-rendered per request rather than prerendered: these pages depend on the
    // session cookie, so there is nothing meaningful to bake in at build time.
    path: '**',
    renderMode: RenderMode.Server
  }
];
