import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { TokenService } from '../../services/token.service';
import { ToastService } from '../../services/toast.service';
import { OpdToken, TodayTokensResponse } from '../../models';

@Component({
  selector: 'app-tokens',
  templateUrl: './tokens.component.html',
  styleUrls: ['./tokens.component.scss'],
})
export class TokensComponent implements OnInit, OnDestroy {
  data: TodayTokensResponse | null = null;
  loading = false;
  private sub!: Subscription;

  constructor(private tokenService: TokenService, private toast: ToastService) {}

  ngOnInit(): void {
    this.tokenService.loadTodayTokens().subscribe();
    this.sub = this.tokenService.todayTokens$.subscribe(d => this.data = d);
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  callNext(): void {
    this.loading = true;
    this.tokenService.callNext().subscribe({
      next: res => { this.toast.success(`Token #${res.data.displayNumber} called`); this.loading = false; },
      error: err => {
        this.toast.warning(err?.error?.message || 'No more patients in queue');
        this.loading = false;
      },
    });
  }

  callToken(t: OpdToken): void {
    this.tokenService.callToken(t._id).subscribe({
      next: () => this.toast.success(`Called: ${t.patientId?.name}`),
      error: () => {},
    });
  }

  skip(t: OpdToken): void {
    this.tokenService.skipToken(t._id).subscribe({
      next: () => this.toast.warning(`Token #${t.displayNumber} skipped`),
    });
  }

  complete(t: OpdToken): void {
    this.tokenService.completeToken(t._id).subscribe({
      next: () => this.toast.success(`Token #${t.displayNumber} completed`),
    });
  }

  filterByStatus(status: string): OpdToken[] {
    return this.data?.tokens?.filter(t => t.status === status) ?? [];
  }

  get progressPct(): number {
    if (!this.data?.stats?.total) return 0;
    return Math.round(((this.data.stats.completed + this.data.stats.skipped) / this.data.stats.total) * 100);
  }

  openVoiceModal(): void {
    document.dispatchEvent(new CustomEvent('open-voice-modal'));
  }
}
