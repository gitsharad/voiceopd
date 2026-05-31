import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';
import { VoiceService } from '../../../services/voice.service';

@Component({
  selector: 'app-navbar',
  template: `
    <header class="topbar">
      <button class="hamburger" (click)="toggleSidebar()" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
      <div class="page-title">{{ pageTitle }}</div>
      <div class="topbar-right">
        <button class="voice-btn" [class.listening]="(voice.isListening$ | async)" (click)="openVoiceModal()">
          <span class="voice-dot"></span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          </svg>
          <span class="voice-label">Voice Register</span>
        </button>
        <div class="topbar-icon" title="Notifications">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span class="notif-dot"></span>
        </div>
        <div class="topbar-avatar" [title]="auth.doctor?.name || ''">
          {{ getInitials(auth.doctor?.name || '') }}
        </div>
      </div>
    </header>
  `,
  styles: [`
    .topbar {
      background: #fff; border-bottom: 1.5px solid #E2E8F0;
      padding: 0 28px; height: 60px;
      display: flex; align-items: center; gap: 16px;
      position: sticky; top: 0; z-index: 50;
    }
    /* Hamburger — tablet only (640–900px) */
    .hamburger {
      display: none; flex-direction: column; justify-content: center; align-items: center;
      gap: 5px; width: 38px; height: 38px; background: none; border: 1.5px solid #E2E8F0;
      cursor: pointer; padding: 4px; border-radius: 10px; flex-shrink: 0;
      span { display: block; width: 18px; height: 2px; background: #1E293B; border-radius: 2px; }
      &:hover { background: #F1F5F9; }
    }
    .page-title {
      font-size: 16px; font-weight: 700; color: #1E293B;
      font-family: 'Space Grotesk', sans-serif; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
    }
    .topbar-right { display: flex; align-items: center; gap: 10px; margin-left: auto; }
    .voice-btn {
      display: flex; align-items: center; gap: 8px;
      background: #0B1437; color: #fff;
      padding: 8px 16px; border-radius: 10px;
      cursor: pointer; font-size: 13px; font-weight: 600;
      border: none; transition: all .2s; font-family: inherit;
      &:hover { background: #162258; }
      &.listening { background: #00A67D; }
    }
    .voice-dot { width: 8px; height: 8px; background: #00C896; border-radius: 50%; }
    .listening .voice-dot { animation: pulse 1s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.6);opacity:.5} }
    .topbar-icon {
      width: 36px; height: 36px; border: 1.5px solid #E2E8F0; border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: #64748B; position: relative;
      &:hover { background: #F8FAFC; }
    }
    .notif-dot {
      position: absolute; top: 6px; right: 6px; width: 7px; height: 7px;
      background: #EF4444; border-radius: 50%; border: 1.5px solid white;
    }
    .topbar-avatar {
      width: 34px; height: 34px; background: #00C896; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: #0B1437; font-weight: 700; font-size: 12px; cursor: pointer;
    }
    /* Tablet: show hamburger */
    @media(max-width: 900px) {
      .topbar { padding: 0 16px; }
      .hamburger { display: flex; }
    }
    /* Mobile: compact top bar — bottom nav handles navigation */
    @media(max-width: 640px) {
      .topbar { padding: 0 14px; height: 54px; }
      .hamburger { display: none; }
      .voice-btn { padding: 7px 12px; gap: 6px; }
      .voice-label { display: none; }
      .topbar-icon { display: none; }
    }
  `],
})
export class NavbarComponent implements OnInit {
  pageTitle = 'Dashboard';

  private titleMap: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/patients': 'Patients',
    '/tokens': 'Token Queue',
    '/prescriptions': 'Prescriptions',
    '/visits': 'Visits',
    '/reports': 'Reports & Analytics',
    '/settings': 'Settings',
  };

  constructor(public auth: AuthService, public voice: VoiceService, private router: Router) {}

  ngOnInit(): void {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      const matched = Object.keys(this.titleMap).find(k => e.url.startsWith(k));
      this.pageTitle = matched ? this.titleMap[matched] : 'VoiceOPD';
    });
  }

  toggleSidebar(): void {
    document.dispatchEvent(new CustomEvent('toggle-sidebar'));
  }

  openVoiceModal(): void {
    document.dispatchEvent(new CustomEvent('open-voice-modal'));
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'DR';
  }
}
