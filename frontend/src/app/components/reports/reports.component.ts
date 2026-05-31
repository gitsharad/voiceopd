import { Component, OnInit } from '@angular/core';
import { ReportService } from '../../services/report.service';
import { DailyData } from '../../models';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
})
export class ReportsComponent implements OnInit {
  weeklyData: DailyData[] = [];
  monthlyData: any[] = [];
  topMedicines: { _id: string; count: number }[] = [];
  topDiagnoses: { _id: string; count: number }[] = [];
  loading = true;

  constructor(private reports: ReportService) {}

  ngOnInit(): void {
    Promise.all([
      this.reports.getWeeklyReport().toPromise(),
      this.reports.getMonthlyReport().toPromise(),
      this.reports.getTopMedicines(8).toPromise(),
      this.reports.getTopDiagnoses(6).toPromise(),
    ]).then(([w, m, med, diag]) => {
      this.weeklyData = w?.data || [];
      this.monthlyData = m?.data || [];
      this.topMedicines = med?.data || [];
      this.topDiagnoses = diag?.data || [];
      this.loading = false;
    });
  }

  get weeklyMax(): number { return Math.max(...this.weeklyData.map(d => d.patients), 1); }
  get medMax(): number { return Math.max(...this.topMedicines.map(m => m.count), 1); }
  get diagMax(): number { return Math.max(...this.topDiagnoses.map(d => d.count), 1); }

  getBarPct(val: number, max: number): string { return `${Math.round((val / max) * 100)}%`; }
  formatDay(dateStr: string): string { return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short' }); }

  get totalWeeklyPatients(): number { return this.weeklyData.reduce((s, d) => s + d.patients, 0); }
  get totalWeeklyRevenue(): number { return this.weeklyData.reduce((s, d) => s + d.revenue, 0); }
}
