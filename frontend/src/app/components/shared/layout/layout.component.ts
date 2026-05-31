import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { TokenService } from '../../../services/token.service';

@Component({
  selector: 'app-layout',
  template: `
    <div class="app-shell">
      <app-sidebar [class.open]="sidebarOpen"></app-sidebar>

      <!-- Sidebar overlay (tablet/desktop drawer) -->
      <div class="sidebar-overlay" [class.visible]="sidebarOpen" (click)="closeSidebar()"></div>

      <div class="main-area">
        <app-navbar></app-navbar>
        <main class="page-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>

    <!-- ── Mobile bottom navigation ──────────────────────────────── -->
    <nav class="bottom-nav">
      <a class="bn-item" routerLink="/dashboard"      [class.active]="isActive('/dashboard')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
        <span>Home</span>
      </a>
      <a class="bn-item" routerLink="/patients"       [class.active]="isActive('/patients')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span>Patients</span>
      </a>
      <a class="bn-item bn-center" routerLink="/tokens" [class.active]="isActive('/tokens')">
        <div class="bn-center-ring">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span class="bn-badge" *ngIf="pendingTokens > 0">{{ pendingTokens > 9 ? '9+' : pendingTokens }}</span>
        </div>
        <span>Tokens</span>
      </a>
      <a class="bn-item" routerLink="/prescriptions"  [class.active]="isActive('/prescriptions')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <span>Rx</span>
      </a>
      <a class="bn-item" routerLink="/settings"       [class.active]="isActive('/settings')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M17.66 17.66l-1.41-1.41M6.34 6.34l-1.41-1.41"/>
        </svg>
        <span>Settings</span>
      </a>
    </nav>

    <app-voice-modal></app-voice-modal>
    <app-patient-history-modal></app-patient-history-modal>
    <app-toast-container></app-toast-container>
  `,
  styles: [`
    /* ── Shell ──────────────────────────────────────── */
    .app-shell { display: flex; min-height: 100vh; }
    .main-area {
      flex: 1; margin-left: 240px; display: flex;
      flex-direction: column; min-height: 100vh; background: #F0F4FF;
    }
    .page-content { flex: 1; padding: 24px 28px; }

    /* ── Sidebar overlay ────────────────────────────── */
    .sidebar-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,.5); z-index: 90;
      opacity: 0; transition: opacity .25s; pointer-events: none;
    }

    /* ── Bottom nav (hidden on desktop) ─────────────── */
    .bottom-nav { display: none; }

    /* ── Tablet (hamburger drawer) ──────────────────── */
    @media(max-width: 900px) {
      .main-area  { margin-left: 0; }
      .page-content { padding: 16px 16px 16px; }
      .sidebar-overlay { display: block; pointer-events: none; }
      .sidebar-overlay.visible { opacity: 1; pointer-events: all; }
    }

    /* ── Mobile (bottom nav) ─────────────────────────── */
    @media(max-width: 640px) {
      .page-content { padding: 14px 14px 82px; }

      .bottom-nav {
        display: flex; align-items: stretch;
        position: fixed; bottom: 0; left: 0; right: 0;
        height: 64px; background: #fff;
        border-top: 1.5px solid #E2E8F0;
        z-index: 200;
        box-shadow: 0 -4px 20px rgba(0,0,0,.08);
      }
      .bn-item {
        flex: 1; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 3px;
        text-decoration: none; color: #94A3B8;
        font-size: 10px; font-weight: 600; padding: 6px 4px;
        transition: color .15s; font-family: 'Plus Jakarta Sans', sans-serif;
        -webkit-tap-highlight-color: transparent;
        svg { width: 20px; height: 20px; flex-shrink: 0; }
        &.active { color: #00A67D; }
      }
      .bn-center {
        flex: 1.2; position: relative;
        justify-content: flex-end; padding-bottom: 8px;
      }
      .bn-center-ring {
        width: 48px; height: 48px; border-radius: 50%;
        background: #0B1437; display: flex; align-items: center;
        justify-content: center; position: relative;
        box-shadow: 0 4px 16px rgba(11,20,55,.35);
        margin-bottom: 2px;
        svg { width: 22px; height: 22px; color: #fff; }
      }
      .bn-item.bn-center.active .bn-center-ring { background: #00C896; }
      .bn-badge {
        position: absolute; top: -3px; right: -3px;
        background: #EF4444; color: #fff;
        font-size: 9px; font-weight: 700; font-family: 'Space Grotesk', sans-serif;
        min-width: 16px; height: 16px; border-radius: 8px; padding: 0 3px;
        display: flex; align-items: center; justify-content: center;
        border: 2px solid #fff;
      }
    }
  `]
})
export class LayoutComponent implements OnInit, OnDestroy {
  sidebarOpen   = false;
  pendingTokens = 0;

  constructor(private router: Router, private tokenService: TokenService) {}

  ngOnInit(): void {
    document.addEventListener('toggle-sidebar', this.onToggle);
    document.addEventListener('close-sidebar',  this.onClose);
    this.tokenService.todayTokens$.subscribe(d => {
      this.pendingTokens = d?.stats?.waiting ?? 0;
    });
  }

  ngOnDestroy(): void {
    document.removeEventListener('toggle-sidebar', this.onToggle);
    document.removeEventListener('close-sidebar',  this.onClose);
  }

  private onToggle = () => { this.sidebarOpen = !this.sidebarOpen; };
  private onClose  = () => { this.sidebarOpen = false; };

  closeSidebar(): void { this.sidebarOpen = false; }

  isActive(path: string): boolean { return this.router.url.startsWith(path); }
}
