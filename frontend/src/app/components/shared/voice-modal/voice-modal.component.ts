import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PatientService } from '../../../services/patient.service';
import { VoiceService } from '../../../services/voice.service';
import { ToastService } from '../../../services/toast.service';
import { AuthService } from '../../../services/auth.service';
import { Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';

@Component({
  selector: 'app-voice-modal',
  templateUrl: './voice-modal.component.html',
  styleUrls: ['./voice-modal.component.scss'],
})
export class VoiceModalComponent implements OnInit, OnDestroy {
  isOpen       = false;
  isSubmitting = false;
  voiceUsed    = false;

  // 'idle' | 'global' | <fieldName>
  captureState: 'idle' | 'global' | string = 'idle';

  // Editable transcript box shown above the form
  transcriptText = '';

  // Fields filled by voice (shows green badge)
  voiceFilled = new Set<string>();

  // The field the user is currently speaking about (highlighted in real time)
  voiceActiveField: string | null = null;

  form: FormGroup;
  selectedLanguage: 'marathi' | 'hindi' | 'english' = 'english';

  private subs:            Subscription[] = [];
  private listenSub?:      Subscription;
  private fieldSub?:       Subscription;
  private segmentSub?:     Subscription;
  private interimSub?:     Subscription;
  private fillTimer?:      ReturnType<typeof setTimeout>;
  private activeTimer?:    ReturnType<typeof setTimeout>;
  private restartCount     = 0;
  private readonly MAX_RESTARTS = 2;

  get isGlobalCapturing(): boolean { return this.captureState === 'global'; }
  get fieldCapturing(): string | null {
    return (this.captureState !== 'idle' && this.captureState !== 'global')
      ? this.captureState : null;
  }

  constructor(
    private fb: FormBuilder,
    private patientService: PatientService,
    public  voice: VoiceService,
    private toast: ToastService,
    public  auth: AuthService,
  ) {
    this.form = this.fb.group({
      name:           ['', [Validators.required, Validators.minLength(2)]],
      phone:          ['', [Validators.pattern(/^[6-9]\d{9}$/)]],
      age:            ['', [Validators.required, Validators.min(0), Validators.max(150)]],
      gender:         ['', Validators.required],
      chiefComplaint: [''],
      address:        [''],
    });
  }

  ngOnInit(): void {
    document.addEventListener('open-voice-modal', () => this.open());

    // Mirror live transcript into the box during global capture
    this.subs.push(
      this.voice.transcript$.subscribe(t => {
        if (this.isGlobalCapturing) {
          this.transcriptText = t;
          if (t) this.restartCount = 0;
        }
      })
    );
  }

  ngOnDestroy(): void {
    document.removeEventListener('open-voice-modal', () => {});
    this.subs.forEach(s => s.unsubscribe());
    this.stopAll();
  }

  open():  void { this.isOpen = true; }
  close(): void {
    this.stopAll();
    this.isOpen        = false;
    this.voiceUsed     = false;
    this.transcriptText = '';
    this.voiceFilled.clear();
    this.form.reset({ gender: '' });
  }

  closeOnOverlay(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) this.close();
  }

  // ── Global (all-in-one) capture ──────────────────────────────────

  startGlobal(): void {
    this.stopAll();                          // clean up any prior capture
    clearTimeout(this.fillTimer);
    clearTimeout(this.activeTimer);

    this.voiceUsed        = true;
    this.transcriptText   = '';
    this.voiceActiveField = null;
    this.voiceFilled.clear();
    this.captureState     = 'global';
    this.restartCount     = 0;
    this.voice.clearTranscript();

    // ── 1. Interim stream → highlight which field the user is currently naming
    this.interimSub = this.voice.interim$.subscribe(interim => {
      if (this.captureState !== 'global') return;
      if (interim) {
        const detected = this.voice.detectActiveField(interim);
        if (detected) this.voiceActiveField = detected;
      }
    });

    // ── 2. Final-segment stream → fill fields + detect save command
    this.segmentSub = this.voice.finalSegment$.subscribe(segment => {
      if (this.captureState !== 'global') return;

      if (this.voice.detectSaveCommand(segment)) {
        this.stopGlobal();
        setTimeout(() => this.voiceSubmit(), 600);
        return;
      }

      const parsed = this.voice.parseAll(segment);
      (['name', 'age', 'gender', 'phone', 'chiefComplaint'] as const).forEach(f => {
        const ctrl = this.form.get(f);
        if (parsed[f] != null && ctrl && !ctrl.dirty) {
          ctrl.setValue(parsed[f]);
          ctrl.markAsDirty();   // prevent later segments from overwriting this field
          this.voiceFilled.add(f);
          // briefly flash the field that just got filled
          this.voiceActiveField = f;
          clearTimeout(this.activeTimer);
          this.activeTimer = setTimeout(() => { this.voiceActiveField = null; }, 1200);
        }
      });
    });

    // ── 3. isListening stream → auto-restart on pause, finalize after MAX_RESTARTS
    this.listenSub = this.voice.isListening$.pipe(skip(1)).subscribe(listening => {
      if (!listening && this.captureState === 'global') {
        if (this.restartCount < this.MAX_RESTARTS) {
          this.restartCount++;
          setTimeout(() => {
            if (this.captureState === 'global') this.voice.restartContinuous(this.selectedLanguage);
          }, 300);
        } else {
          this.captureState     = 'idle';
          this.voiceActiveField = null;
          this.listenSub?.unsubscribe();
          this.segmentSub?.unsubscribe();
          this.interimSub?.unsubscribe();
        }
      }
    });

    // ── Start AFTER all subscriptions are ready
    this.voice.start(this.selectedLanguage);
  }

  stopGlobal(): void {
    this.voice.stop();
    this.captureState     = 'idle';
    this.voiceActiveField = null;
    clearTimeout(this.activeTimer);
    this.segmentSub?.unsubscribe();
    this.interimSub?.unsubscribe();
  }

  // Auto-fill fields 900ms after capture ends — gives user a moment
  // to see the transcript before the fields populate.
  private scheduleAutoFill(): void {
    clearTimeout(this.fillTimer);
    if (this.transcriptText.trim()) {
      this.fillTimer = setTimeout(() => this.refillFromTranscript(), 900);
    }
  }

  // Parse the transcript textarea and push values into empty fields.
  // Can also be called manually after the user edits the textarea.
  refillFromTranscript(): void {
    const text = this.transcriptText.trim();
    if (!text) return;
    // Reset dirty + voiceFilled so we re-parse everything fresh from the edited transcript
    this.form.markAsPristine();
    this.voiceFilled.clear();
    this.parseAndFill(text);
  }

  private parseAndFill(transcript: string): void {
    const parsed = this.voice.parseAll(transcript);
    (['name', 'age', 'gender', 'phone', 'chiefComplaint'] as const).forEach(field => {
      const ctrl = this.form.get(field);
      if (parsed[field] != null && ctrl && !ctrl.dirty) {
        ctrl.setValue(parsed[field]);
        ctrl.markAsDirty();   // lock field so re-fill can't overwrite user edits
        this.voiceFilled.add(field);
      }
    });
  }

  // ── Per-field capture ────────────────────────────────────────────

  captureField(field: string): void {
    if (this.captureState !== 'idle') this.stopAll();
    this.voiceUsed    = true;
    this.captureState = field;
    this.voice.clearTranscript();

    this.fieldSub = this.voice.captureOnce(this.selectedLanguage).subscribe({
      next: (transcript) => {
        const value = this.voice.parseField(field, transcript);
        if (value !== null) {
          this.form.get(field)?.setValue(value);
          this.voiceFilled.add(field);
        }
        this.captureState = 'idle';
      },
      error: () => { this.captureState = 'idle'; },
    });
  }

  stopAll(): void {
    this.fieldSub?.unsubscribe();
    this.listenSub?.unsubscribe();
    this.segmentSub?.unsubscribe();
    this.interimSub?.unsubscribe();
    clearTimeout(this.fillTimer);
    clearTimeout(this.activeTimer);
    this.voice.stop();
    this.captureState     = 'idle';
    this.voiceActiveField = null;
  }

  // Submit triggered by voice command — shows which required fields are missing
  voiceSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const missing: string[] = [];
      if (this.form.get('name')?.invalid)   missing.push('Patient Name');
      if (this.form.get('age')?.invalid)    missing.push('Age');
      if (this.form.get('gender')?.invalid) missing.push('Gender');
      this.toast.warning(`Please fill: ${missing.join(', ')}`);
      return;
    }
    this.submit();
  }

  isStepDone(field: string): boolean {
    const v = this.form.get(field)?.value;
    return v !== null && v !== '' && v !== undefined;
  }

  // ── Submit ───────────────────────────────────────────────────────

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.stopAll();
    this.isSubmitting = true;
    const v = this.form.value;
    this.patientService.createPatient({
      name: v.name, phone: v.phone, age: +v.age,
      gender: v.gender, address: v.address,
      chiefComplaint: v.chiefComplaint,
      registeredVia: this.voiceUsed ? 'voice' : 'manual',
    }).subscribe({
      next: (res) => {
        this.toast.success(`✓ ${res.data.patient.name} registered — Token #${res.data.token.tokenNumber}`);
        this.close();
        this.isSubmitting = false;
        // Notify other components (e.g. patients list) to reload
        document.dispatchEvent(new CustomEvent('patient-registered', { detail: res.data }));
      },
      error: () => { this.isSubmitting = false; },
    });
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c?.invalid && c?.touched);
  }
}
