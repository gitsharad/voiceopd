import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PatientService } from '../../../services/patient.service';
import { ToastService } from '../../../services/toast.service';
import { Patient, Visit, Prescription } from '../../../models';

@Component({
  selector: 'app-patient-detail',
  templateUrl: './patient-detail.component.html',
  styleUrls: ['./patient-detail.component.scss'],
})
export class PatientDetailComponent implements OnInit {
  patient: Patient | null = null;
  visits: Visit[] = [];
  prescriptions: Prescription[] = [];
  patientId = '';
  loadError = '';

  // Edit modal
  showEdit    = false;
  saving      = false;
  editForm!:  FormGroup;

  // Delete confirm
  confirmDelete = false;
  deleting      = false;

  readonly bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  constructor(
    private route:          ActivatedRoute,
    private router:         Router,
    private fb:             FormBuilder,
    private patientService: PatientService,
    private toast:          ToastService,
  ) {}

  ngOnInit(): void {
    this.patientId = this.route.snapshot.paramMap.get('id')!;
    this.patientService.getPatientHistory(this.patientId).subscribe({
      next: res => {
        this.patient = res.data.patient;
        this.visits  = res.data.visits;
        this.prescriptions = res.data.prescriptions;
      },
      error: () => { this.loadError = 'Patient not found.'; },
    });
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }

  // ── Edit ────────────────────────────────────────────────────────────
  openEdit(): void {
    const p = this.patient as any;
    this.editForm = this.fb.group({
      name:              [p.name, [Validators.required, Validators.minLength(2)]],
      phone:             [p.phone || '', [Validators.pattern(/^[6-9]\d{9}$/)]],
      age:               [p.age, [Validators.required, Validators.min(0), Validators.max(150)]],
      gender:            [p.gender, Validators.required],
      bloodGroup:        [p.bloodGroup || ''],
      allergies:         [(p.allergies || []).join(', ')],
      chronicConditions: [(p.chronicConditions || []).join(', ')],
      address:           [p.address || ''],
    });
    this.showEdit = true;
  }

  closeEdit(): void { this.showEdit = false; }

  closeEditOnOverlay(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('edit-overlay')) this.closeEdit();
  }

  saveEdit(): void {
    if (this.editForm.invalid) { this.editForm.markAllAsTouched(); return; }
    this.saving = true;
    const v = this.editForm.value;
    const dto = {
      name:              v.name.trim(),
      phone:             v.phone.trim(),
      age:               +v.age,
      gender:            v.gender,
      bloodGroup:        v.bloodGroup || '',
      allergies:         v.allergies ? v.allergies.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      chronicConditions: v.chronicConditions ? v.chronicConditions.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      address:           v.address.trim(),
    };
    this.patientService.updatePatient(this.patientId, dto).subscribe({
      next: res => {
        this.patient = res.data;
        this.toast.success('Patient info updated');
        this.showEdit = false;
        this.saving   = false;
      },
      error: () => { this.saving = false; },
    });
  }

  // ── Delete ──────────────────────────────────────────────────────────
  deletePatient(): void {
    this.deleting = true;
    this.patientService.deletePatient(this.patientId).subscribe({
      next: () => {
        this.toast.success('Patient deleted');
        this.router.navigate(['/patients']);
      },
      error: () => { this.deleting = false; },
    });
  }
}
