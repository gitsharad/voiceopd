import { Component } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Public registration is disabled — clinic accounts are
 * created by the platform admin from the Settings panel.
 * This component just redirects anyone who lands on /register.
 */
@Component({
  selector: 'app-register',
  template: `
    <div class="blocked-page">
      <div class="blocked-card">
        <div class="brand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"
               stroke-linecap="round" width="28" height="28">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          </svg>
        </div>
        <h1>VoiceOPD</h1>
        <div class="lock-icon">🔒</div>
        <h2>Registration by Invite Only</h2>
        <p>
          New clinic accounts are created by the VoiceOPD admin team.<br>
          Please contact us to get your clinic onboarded.
        </p>
        <a href="mailto:admin@voiceopd.com" class="btn-contact">
          Contact Admin
        </a>
        <button class="btn-login" (click)="goLogin()">
          Already have an account? Sign In
        </button>
      </div>
    </div>
  `,
  styles: [`
    .blocked-page {
      min-height: 100vh; background: #F0F4FF;
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
    }
    .blocked-card {
      background: #fff; border-radius: 24px;
      padding: 40px 32px; max-width: 400px; width: 100%;
      text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,.08);
    }
    .brand-icon {
      width: 56px; height: 56px; background: #0B1437; border-radius: 16px;
      display: inline-flex; align-items: center; justify-content: center;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 20px; font-weight: 800; color: #0B1437;
      font-family: 'Space Grotesk', sans-serif; margin-bottom: 24px;
    }
    .lock-icon { font-size: 40px; margin-bottom: 12px; }
    h2 {
      font-size: 18px; font-weight: 800; color: #1E293B;
      font-family: 'Space Grotesk', sans-serif; margin-bottom: 10px;
    }
    p { font-size: 13.5px; color: #64748B; line-height: 1.6; margin-bottom: 28px; }
    .btn-contact {
      display: block; width: 100%;
      background: #00C896; color: #0B1437;
      padding: 13px; border-radius: 12px;
      font-size: 14px; font-weight: 700;
      font-family: 'Plus Jakarta Sans', sans-serif;
      text-decoration: none; margin-bottom: 12px;
      transition: background .2s;
      &:hover { background: #00A67D; color: #fff; }
    }
    .btn-login {
      width: 100%; background: transparent;
      border: 1.5px solid #E2E8F0; color: #64748B;
      padding: 11px; border-radius: 12px;
      font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: all .15s;
      &:hover { border-color: #0B1437; color: #0B1437; }
    }
  `]
})
export class RegisterComponent {
  constructor(private router: Router) {}
  goLogin(): void { this.router.navigate(['/login']); }
}
