import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastService } from '../../services/toast.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
})
export class AdminComponent implements OnInit {
  private readonly API = `${environment.apiUrl}/admin`;

  stats:          any   = null;
  clinics:        any[] = [];
  filtered:       any[] = [];
  loadingClinics  = false;

  searchQ      = '';
  filterStatus = '';
  filterPlan   = '';

  // Detail modal
  detail:    any    = null;
  detailTab  = 'overview';
  subForm!:  FormGroup;
  savingSub  = false;

  // Add clinic modal
  showAddClinic = false;
  addForm!:     FormGroup;
  addingClinic  = false;

  constructor(
    private http:  HttpClient,
    private fb:    FormBuilder,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadClinics();
    this.initAddForm();
  }

  private initAddForm(): void {
    this.addForm = this.fb.group({
      name:           ['', Validators.required],
      clinicName:     ['', Validators.required],
      email:          ['', [Validators.required, Validators.email]],
      phone:          ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
      specialization: ['General Physician'],
      password:       ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  // ── Stats ────────────────────────────────────────────────────────
  loadStats(): void {
    this.http.get<any>(`${this.API}/stats`).subscribe({
      next: res => { this.stats = res.data; },
    });
  }

  // ── Clinics ──────────────────────────────────────────────────────
  loadClinics(): void {
    this.loadingClinics = true;
    this.http.get<any>(`${this.API}/clinics`).subscribe({
      next: res => {
        this.clinics        = res.data;
        this.loadingClinics = false;
        this.applyFilter();
      },
      error: () => { this.loadingClinics = false; },
    });
  }

  applyFilter(): void {
    let list = [...this.clinics];
    if (this.searchQ) {
      const q = this.searchQ.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.ownerDoctor?.name?.toLowerCase().includes(q) ||
        c.ownerDoctor?.email?.toLowerCase().includes(q)
      );
    }
    if (this.filterStatus === 'active')   list = list.filter(c => c.isActive);
    if (this.filterStatus === 'inactive') list = list.filter(c => !c.isActive);
    if (this.filterPlan) list = list.filter(c => c.subscriptionPlan === this.filterPlan);
    this.filtered = list;
  }

  // ── Clinic detail ────────────────────────────────────────────────
  openDetail(c: any): void {
    this.detailTab = 'overview';
    this.http.get<any>(`${this.API}/clinics/${c._id}`).subscribe({
      next: res => {
        this.detail = res.data;
        this.buildSubForm(res.data.clinic);
      },
    });
  }

  closeDetail(): void { this.detail = null; }

  buildSubForm(clinic: any): void {
    const trialDate = clinic.trialEndsAt
      ? new Date(clinic.trialEndsAt).toISOString().slice(0, 10)
      : '';
    this.subForm = this.fb.group({
      subscriptionPlan: [clinic.subscriptionPlan],
      trialEndsAt:      [trialDate],
      isActive:         [clinic.isActive],
      consultationFee:  [clinic.consultationFee],
    });
  }

  saveSubscription(): void {
    this.savingSub = true;
    const v = this.subForm.value;
    this.http.put<any>(`${this.API}/clinics/${this.detail.clinic._id}`, v).subscribe({
      next: res => {
        // Update local lists
        this.detail.clinic = { ...this.detail.clinic, ...v };
        const idx = this.clinics.findIndex(c => c._id === this.detail.clinic._id);
        if (idx > -1) Object.assign(this.clinics[idx], v);
        this.applyFilter();
        this.loadStats();
        this.toast.success('Clinic updated');
        this.savingSub = false;
      },
      error: () => { this.savingSub = false; },
    });
  }

  // ── Toggle doctor status ─────────────────────────────────────────
  toggleDoctor(d: any): void {
    const newStatus = !d.isActive;
    this.http.put<any>(`${this.API}/doctors/${d._id}`, { isActive: newStatus }).subscribe({
      next: () => {
        d.isActive = newStatus;
        this.toast.success(`${d.name} ${newStatus ? 'activated' : 'deactivated'}`);
      },
    });
  }

  // ── Add clinic ────────────────────────────────────────────────────
  openAddClinic(): void {
    this.addForm.reset({ specialization: 'General Physician' });
    this.showAddClinic = true;
  }

  closeAddClinic(): void { this.showAddClinic = false; }

  submitAddClinic(): void {
    if (this.addForm.invalid) { this.addForm.markAllAsTouched(); return; }
    this.addingClinic = true;
    this.http.post(`${environment.apiUrl}/auth/register`, this.addForm.value).subscribe({
      next: () => {
        this.toast.success('Clinic created successfully!');
        this.closeAddClinic();
        this.addingClinic = false;
        this.loadClinics();
        this.loadStats();
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'Failed to create clinic');
        this.addingClinic = false;
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────
  isTrialExpired(c: any): boolean {
    if (c.subscriptionPlan !== 'trial' || !c.trialEndsAt) return false;
    return new Date(c.trialEndsAt) < new Date();
  }

  maxCount = 0;
  barWidth(count: number): number {
    if (!this.detail?.monthlyStats?.length) return 0;
    const max = Math.max(...this.detail.monthlyStats.map((m: any) => m.count));
    return max ? Math.round((count / max) * 100) : 0;
  }

  formatMonth(ym: string): string {
    const [y, m] = ym.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[+m - 1]} ${y}`;
  }
}
