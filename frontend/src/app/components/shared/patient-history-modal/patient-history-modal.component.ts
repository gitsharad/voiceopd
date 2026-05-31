import { Component, OnInit, OnDestroy } from '@angular/core';
import { PatientService } from '../../../services/patient.service';

@Component({
  selector: 'app-patient-history-modal',
  templateUrl: './patient-history-modal.component.html',
  styleUrls: ['./patient-history-modal.component.scss'],
})
export class PatientHistoryModalComponent implements OnInit, OnDestroy {
  isOpen  = false;
  loading = false;
  patient: any = null;
  combined: { visit: any; prescription: any | null }[] = [];

  private boundOpen = (e: any) => this.open(e.detail.patientId);

  constructor(private patientService: PatientService) {}

  ngOnInit(): void {
    document.addEventListener('open-patient-history', this.boundOpen);
  }

  ngOnDestroy(): void {
    document.removeEventListener('open-patient-history', this.boundOpen);
  }

  open(patientId: string): void {
    this.isOpen  = true;
    this.loading = true;
    this.patient = null;
    this.combined = [];

    this.patientService.getPatientHistory(patientId).subscribe({
      next: res => {
        this.patient = res.data.patient;
        const visits: any[]        = res.data.visits        || [];
        const prescriptions: any[] = res.data.prescriptions || [];

        this.combined = visits.map(v => ({
          visit: v,
          prescription: prescriptions.find(p =>
            (p.visitId  && p.visitId  === v._id)   ||
            (p.tokenId  && v.tokenId  && p.tokenId === v.tokenId)
          ) ?? null,
        }));
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  close(): void { this.isOpen = false; }

  closeOnOverlay(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('history-overlay')) this.close();
  }

  getInitials(name: string): string {
    return name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  }

  hasVitals(visit: any): boolean {
    const vs = visit?.vitalSigns;
    return !!(vs?.bloodPressure?.systolic || vs?.pulse || vs?.temperature || vs?.weight || vs?.spo2);
  }
}
