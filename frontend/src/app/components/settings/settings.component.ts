import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { environment } from '../../../environments/environment';
import { Clinic } from '../../models';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  clinicForm: FormGroup;
  clinic:     Clinic | null = null;
  saving    = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    public auth: AuthService,
    private toast: ToastService,
  ) {
    this.clinicForm = this.fb.group({
      name: [''],
      phone: [''],
      city: [''],
      state: [''],
      pincode: [''],
      morningOpen: ['09:00'], morningClose: ['13:00'],
      eveningOpen: ['17:00'], eveningClose: ['21:00'],
      consultationFee: [300],
      whatsappEnabled: [false],
      whatsappNumber: [''],
      marathi: [true], hindi: [true], english: [true],
    });

  }

  ngOnInit(): void {
    this.auth.clinic$.subscribe(c => {
      if (c) {
        this.clinic = c;
        this.clinicForm.patchValue({
          name: c.name,
          phone: c.phone,
          city: c.address?.city || '',
          state: c.address?.state || '',
          pincode: c.address?.pincode || '',
          morningOpen: c.opdTiming?.morning?.open || '09:00',
          morningClose: c.opdTiming?.morning?.close || '13:00',
          eveningOpen: c.opdTiming?.evening?.open || '17:00',
          eveningClose: c.opdTiming?.evening?.close || '21:00',
          consultationFee: c.consultationFee,
          whatsappEnabled: c.whatsappEnabled,
          whatsappNumber: c.whatsappNumber || '',
          marathi: c.supportedLanguages.includes('marathi'),
          hindi: c.supportedLanguages.includes('hindi'),
          english: c.supportedLanguages.includes('english'),
        });
      }
    });
  }

  saveClinic(): void {
    this.saving = true;
    const v = this.clinicForm.value;
    const langs = ['marathi', 'hindi', 'english'].filter(l => v[l]);
    const payload = {
      name: v.name, phone: v.phone, consultationFee: v.consultationFee,
      address: { city: v.city, state: v.state, pincode: v.pincode },
      opdTiming: {
        morning: { open: v.morningOpen, close: v.morningClose },
        evening: { open: v.eveningOpen, close: v.eveningClose },
      },
      whatsappEnabled: v.whatsappEnabled,
      whatsappNumber: v.whatsappNumber,
      supportedLanguages: langs,
    };
    this.http.put(`${environment.apiUrl}/clinic`, payload).subscribe({
      next: () => { this.toast.success('Clinic settings saved'); this.saving = false; },
      error: () => { this.saving = false; },
    });
  }

  get trialDaysLeft(): number {
    if (!this.clinic?.trialEndsAt) return 0;
    const diff = new Date(this.clinic.trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
}
