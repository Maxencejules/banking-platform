import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/auth/auth.guards';
import { AuthService } from './core/auth/auth.service';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    title: 'Open an account',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: () => inject(AuthService).homeUrl(),
      },
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardComponent),
      },
      {
        path: 'accounts/:id',
        title: 'Account',
        loadComponent: () =>
          import('./features/account-detail/account-detail').then((m) => m.AccountDetailComponent),
      },
      {
        path: 'transfer',
        title: 'Transfer',
        loadComponent: () => import('./features/transfer/transfer').then((m) => m.TransferComponent),
      },
      {
        path: 'admin',
        title: 'Admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/admin').then((m) => m.AdminComponent),
      },
    ],
  },
  {
    path: '**',
    title: 'Page not found',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFoundComponent),
  },
];
