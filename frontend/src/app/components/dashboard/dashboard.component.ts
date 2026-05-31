import { Component, OnInit, OnDestroy } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';
import { ReportService } from '../../services/report.service';
import { TokenService } from '../../services/token.service';
import { AuthService } from '../../services/auth.service';
import { DashboardStats, DailyData, TodayTokensResponse } from '../../models';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  stats: DashboardStats | null = null;
  weeklyData: DailyData[] = [];
  tokenData: TodayTokensResponse | null = null;
  loading = true;
  private subs: Subscription[] = [];
  greeting = 'Good Morning';

  constructor(
    private reports: ReportService,
    private tokenService: TokenService,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    const h = new Date().getHours();
    this.greeting = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';

    // Poll stats every 30s
    this.subs.push(
      interval(30000).pipe(startWith(0), switchMap(() => this.reports.getDashboardStats()))
        .subscribe(res => { this.stats = res.data; this.loading = false; })
    );

    this.reports.getWeeklyReport().subscribe(res => this.weeklyData = res.data);

    this.tokenService.loadTodayTokens().subscribe();
    this.subs.push(
      this.tokenService.todayTokens$.subscribe(d => this.tokenData = d)
    );
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  callNext(): void {
    this.tokenService.callNext().subscribe();
  }

  get chartMax(): number {
    return Math.max(...this.weeklyData.map(d => d.patients), 1);
  }

  getBarHeight(val: number): string {
    return `${Math.round((val / this.chartMax) * 100)}%`;
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { weekday: 'short' });
  }

  get today(): string {
    return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  openVoiceModal(): void {
    document.dispatchEvent(new CustomEvent('open-voice-modal'));
  }

  getWaiting() {
    return this.tokenData?.tokens?.filter(t => t.status === 'waiting') ?? [];
  }
}
