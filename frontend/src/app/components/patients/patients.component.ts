import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { PatientService } from '../../services/patient.service';
import { TokenService } from '../../services/token.service';
import { ToastService } from '../../services/toast.service';
import { Patient } from '../../models';

@Component({
  selector: 'app-patients',
  templateUrl: './patients.component.html',
  styleUrls: ['./patients.component.scss'],
})
export class PatientsComponent implements OnInit, OnDestroy {
  patients: Patient[] = [];
  total = 0;
  page = 1;
  limit = 12;
  pages = 1;
  loading = false;
  searchQuery = '';
  private search$ = new Subject<string>();

  queueingId = '';

  constructor(
    private patientService: PatientService,
    private tokenService: TokenService,
    private toast: ToastService,
  ) {}

  private onPatientRegistered = () => { this.page = 1; this.load(); };

  ngOnInit(): void {
    this.load();
    document.addEventListener('patient-registered', this.onPatientRegistered);
    this.search$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(q => {
        this.loading = true;
        this.page = 1;
        return this.patientService.getPatients({ search: q, page: 1, limit: this.limit });
      })
    ).subscribe(res => {
      this.patients = res.data;
      this.total = res.pagination.total;
      this.pages = res.pagination.pages;
      this.loading = false;
    });
  }

  ngOnDestroy(): void {
    document.removeEventListener('patient-registered', this.onPatientRegistered);
  }

  load(): void {
    this.loading = true;
    this.patientService.getPatients({ search: this.searchQuery, page: this.page, limit: this.limit })
      .subscribe(res => {
        this.patients = res.data;
        this.total = res.pagination.total;
        this.pages = res.pagination.pages;
        this.loading = false;
      });
  }

  onSearch(q: string): void { this.searchQuery = q; this.search$.next(q); }

  goPage(p: number): void { if (p >= 1 && p <= this.pages) { this.page = p; this.load(); } }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }

  avatarColors = ['#E0FBF3', '#EFF6FF', '#EDE9FE', '#FEF3C7'];
  textColors = ['#00A67D', '#2563EB', '#7C3AED', '#92400E'];

  getAvatarColor(index: number): string { return this.avatarColors[index % 4]; }
  getTextColor(index: number): string { return this.textColors[index % 4]; }

  openVoiceModal(): void {
    document.dispatchEvent(new CustomEvent('open-voice-modal'));
  }

  openHistory(patientId: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    document.dispatchEvent(new CustomEvent('open-patient-history', { detail: { patientId } }));
  }

  addToQueue(patient: Patient, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const id = (patient as any)._id;
    this.queueingId = id;
    this.tokenService.addToQueue(id).subscribe({
      next: res => {
        this.toast.success(`${patient.name} added to queue — Token #${(res.data as any).displayNumber}`);
        this.queueingId = '';
      },
      error: err => {
        this.toast.error(err?.error?.message || 'Could not add to queue');
        this.queueingId = '';
      },
    });
  }
}
