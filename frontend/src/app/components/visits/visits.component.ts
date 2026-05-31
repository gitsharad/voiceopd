import { Component, OnInit } from '@angular/core';
import { VisitService } from '../../services/visit.service';
import { ToastService } from '../../services/toast.service';
import { Visit } from '../../models';

@Component({
  selector: 'app-visits',
  template: `
    <div class="visits-page">
      <div class="page-header">
        <div>
          <h2 class="page-title">Patient Visits</h2>
          <p class="page-sub">{{ total | number }} total visits</p>
        </div>
        <div class="date-filters">
          <input type="date" [(ngModel)]="fromDate" (change)="load()" class="date-input">
          <span>to</span>
          <input type="date" [(ngModel)]="toDate" (change)="load()" class="date-input">
        </div>
      </div>

      <div class="panel">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date & Time</th><th>Patient</th><th>Diagnosis</th>
                <th>Doctor</th><th>Fee</th><th>Payment</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let v of visits">
                <td>
                  <div class="visit-date">{{ v.visitDate | date:'dd MMM yyyy' }}</div>
                  <div class="visit-time">{{ v.visitDate | date:'HH:mm' }}</div>
                </td>
                <td>
                  <div class="pat-name">{{ v.patientId?.name }}</div>
                  <div class="pat-meta">{{ v.patientId?.age }}y · {{ v.patientId?.gender | titlecase }}</div>
                </td>
                <td>{{ v.diagnosis || '—' }}</td>
                <td>{{ v.doctorId?.name }}</td>
                <td>₹{{ v.consultationFee }}</td>
                <td>
                  <span class="pay-pill" [ngClass]="v.paymentStatus">
                    {{ v.paymentStatus | titlecase }}
                  </span>
                </td>
                <td>
                  <button class="tbl-btn" *ngIf="v.paymentStatus === 'pending'"
                    (click)="markPaid(v)">Mark Paid</button>
                  <a class="tbl-btn" [routerLink]="['/prescriptions', v.prescriptionId?._id]"
                    *ngIf="v.prescriptionId">View Rx</a>
                </td>
              </tr>
              <tr *ngIf="!visits.length && !loading">
                <td colspan="7" class="empty-cell">No visits found for selected date range</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="pagination" *ngIf="pages > 1">
        <button (click)="goPage(page - 1)" [disabled]="page === 1">← Prev</button>
        <span>Page {{ page }} of {{ pages }}</span>
        <button (click)="goPage(page + 1)" [disabled]="page === pages">Next →</button>
      </div>
    </div>
  `,
  styles: [`
    .visits-page { display: flex; flex-direction: column; gap: 20px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; }
    .page-title { font-size: 20px; font-weight: 800; color: #1E293B; font-family: 'Space Grotesk', sans-serif; }
    .page-sub { font-size: 13px; color: #64748B; margin-top: 4px; }
    .date-filters { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748B; }
    .date-input { padding: 8px 12px; border: 1.5px solid #E2E8F0; border-radius: 9px; font-size: 13px; font-family: inherit; outline: none; &:focus { border-color: #00C896; } }
    .panel { background: #fff; border-radius: 16px; border: 1.5px solid #E2E8F0; overflow: hidden; }
    .table-wrap { overflow-x: auto; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th { text-align: left; font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; padding: 10px 16px; border-bottom: 1.5px solid #E2E8F0; background: #F8FAFC; white-space: nowrap; }
    .data-table td { padding: 12px 16px; border-bottom: 1px solid #F1F5F9; font-size: 13px; }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table tr:hover td { background: #F8FAFC; }
    .visit-date { font-weight: 600; color: #1E293B; }
    .visit-time { font-size: 11px; color: #94A3B8; }
    .pat-name { font-weight: 600; color: #1E293B; }
    .pat-meta { font-size: 11px; color: #94A3B8; }
    .pay-pill { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; display: inline-block;
      &.paid { background: #E0FBF3; color: #065F46; }
      &.pending { background: #FEF3C7; color: #92400E; }
      &.waived { background: #F1F5F9; color: #475569; }
    }
    .tbl-btn { font-size: 12px; font-weight: 600; padding: 5px 10px; border-radius: 7px; cursor: pointer; border: 1.5px solid #E2E8F0; background: transparent; color: #64748B; transition: all .15s; font-family: inherit; text-decoration: none; margin-right: 4px; display: inline-block; &:hover { border-color: #0B1437; color: #0B1437; } }
    .empty-cell { text-align: center; color: #94A3B8; padding: 32px !important; }
    .pagination { display: flex; align-items: center; gap: 12px; justify-content: center; padding: 8px 0; font-size: 13px; button { padding: 7px 14px; border: 1.5px solid #E2E8F0; border-radius: 8px; background: #fff; cursor: pointer; font-family: inherit; font-size: 13px; &:disabled { opacity: .4; cursor: not-allowed; } &:hover:not(:disabled) { background: #F8FAFC; } } }
  `]
})
export class VisitsComponent implements OnInit {
  visits: Visit[] = [];
  total = 0; page = 1; pages = 1; loading = false;
  fromDate = ''; toDate = '';

  constructor(private visitService: VisitService, private toast: ToastService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.visitService.getVisits({ page: this.page, limit: 20, from: this.fromDate, to: this.toDate })
      .subscribe(res => {
        this.visits = res.data;
        this.total = res.pagination.total;
        this.pages = res.pagination.pages;
        this.loading = false;
      });
  }

  markPaid(v: Visit): void {
    this.visitService.updateVisit(v._id, { paymentStatus: 'paid', paymentMode: 'cash' } as any)
      .subscribe(() => { v.paymentStatus = 'paid'; this.toast.success('Marked as paid'); });
  }

  goPage(p: number): void { if (p >= 1 && p <= this.pages) { this.page = p; this.load(); } }
}
