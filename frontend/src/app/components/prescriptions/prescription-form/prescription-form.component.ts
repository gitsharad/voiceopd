import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, skip, switchMap } from 'rxjs/operators';
import { PrescriptionService } from '../../../services/prescription.service';
import { PatientService } from '../../../services/patient.service';
import { ToastService } from '../../../services/toast.service';
import { VoiceService } from '../../../services/voice.service';
import { AiService, AiRecommendation, AiMedicine } from '../../../services/ai.service';
import { Patient } from '../../../models';

@Component({
  selector: 'app-prescription-form',
  templateUrl: './prescription-form.component.html',
  styleUrls: ['./prescription-form.component.scss'],
})
export class PrescriptionFormComponent implements OnInit, OnDestroy {
  form: FormGroup;
  patient: Patient | null = null;
  patientId = '';
  tokenId   = '';
  loading   = false;

  // ── AI recommendation ────────────────────────────────────────────
  rxPendingSection: string | null = null;
  aiRec: AiRecommendation | null = null;
  aiLoading = false;
  aiAppliedMeds   = new Set<number>();
  aiAppliedAdvice = new Set<number>();
  private aiTimer?: ReturnType<typeof setTimeout>;

  // ── Patient search ───────────────────────────────────────────────
  searchQuery   = '';
  searchResults: Patient[] = [];
  searchLoading = false;
  showDropdown  = false;
  private search$ = new Subject<string>();
  private searchSub?: Subscription;

  // ── Voice state ─────────────────────────────────────────────────
  isRxVoiceActive  = false;
  rxTranscript     = '';
  rxActiveSection: string | null = null;
  rxVoiceFilled    = new Set<string>();
  selectedLanguage: 'marathi' | 'hindi' | 'english' = 'english';

  private rxSegmentSub?:   Subscription;
  private rxInterimSub?:   Subscription;
  private rxListenSub?:    Subscription;
  private rxRestartCount   = 0;
  private readonly RX_MAX  = 2;

  frequencyOptions = ['1-0-0','0-1-0','0-0-1','1-0-1','1-1-0','0-1-1','1-1-1','SOS','Once daily','Twice daily','Thrice daily'];
  durationOptions  = ['1 day','3 days','5 days','7 days','10 days','14 days','1 month','2 months','3 months','Ongoing'];
  routeOptions     = ['oral','topical','injection','inhalation','other'];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private rxService: PrescriptionService,
    private patientService: PatientService,
    private toast: ToastService,
    public  voice: VoiceService,
    private ai: AiService,
  ) {
    this.form = this.fb.group({
      diagnosis:       [''],
      symptoms:        [''],
      advices:         [''],
      followUpDate:    [''],
      consultationFee: [300],
      paymentStatus:   ['paid'],
      paymentMode:     ['cash'],
      clinicalNotes:   [''],
      medicines:       this.fb.array([this.newMedicine()]),
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.patientId = params['patientId'] || '';
      this.tokenId   = params['tokenId']   || '';
      if (this.patientId)
        this.patientService.getPatient(this.patientId).subscribe(res => this.patient = res.data);
    });

    this.searchSub = this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        if (!q.trim()) { this.searchResults = []; this.searchLoading = false; return []; }
        this.searchLoading = true;
        return this.patientService.getPatients({ search: q, limit: 8 });
      }),
    ).subscribe({
      next: res => {
        this.searchResults = (res as any)?.data || [];
        this.searchLoading = false;
        this.showDropdown  = true;
      },
      error: () => { this.searchLoading = false; },
    });
  }

  ngOnDestroy(): void { this.stopRxVoice(); this.searchSub?.unsubscribe(); clearTimeout(this.aiTimer as any); }

  // ── AI recommendation ────────────────────────────────────────────
  triggerAiRecommend(): void {
    clearTimeout(this.aiTimer);
    const diagnosis = this.form.value.diagnosis?.trim();
    const symptoms  = this.form.value.symptoms?.trim();
    if (!diagnosis && !symptoms) { this.aiRec = null; return; }
    this.aiTimer = setTimeout(() => {
      this.aiLoading = true;
      this.aiRec = null;
      this.aiAppliedMeds.clear();
      this.aiAppliedAdvice.clear();
      this.ai.recommend(diagnosis || '', symptoms || '').subscribe({
        next: res => { this.aiRec = res.data; this.aiLoading = false; },
        error: ()  => { this.aiLoading = false; },
      });
    }, 800);
  }

  applyAiMedicine(med: AiMedicine, index: number): void {
    let targetIdx = -1;
    for (let i = 0; i < this.medicines.length; i++) {
      if (!this.medicines.at(i).get('name')?.value) { targetIdx = i; break; }
    }
    if (targetIdx === -1) { this.addMedicine(); targetIdx = this.medicines.length - 1; }
    this.medicines.at(targetIdx).patchValue(med);
    this.aiAppliedMeds.add(index);
  }

  applyAllAiMedicines(): void {
    this.aiRec?.medicines.forEach((med, i) => {
      if (!this.aiAppliedMeds.has(i)) this.applyAiMedicine(med, i);
    });
  }

  applyAiAdvice(line: string, index: number): void {
    const existing = this.form.value.advices?.trim();
    this.form.patchValue({ advices: existing ? `${existing}\n${line}` : line });
    this.aiAppliedAdvice.add(index);
  }

  applyAllAiAdvice(): void {
    this.aiRec?.advice.forEach((a, i) => {
      if (!this.aiAppliedAdvice.has(i)) this.applyAiAdvice(a, i);
    });
  }

  applyAiClinicalNotes(): void {
    if (this.aiRec?.clinicalNotes) this.form.patchValue({ clinicalNotes: this.aiRec.clinicalNotes });
  }

  onSearch(q: string): void { this.search$.next(q); }

  selectPatient(p: Patient): void {
    this.patient      = p;
    this.patientId    = (p as any)._id;
    this.searchQuery  = '';
    this.searchResults = [];
    this.showDropdown  = false;
  }

  clearPatient(): void {
    this.patient   = null;
    this.patientId = '';
  }

  // ── Form helpers ────────────────────────────────────────────────
  get medicines(): FormArray { return this.form.get('medicines') as FormArray; }

  newMedicine(): FormGroup {
    return this.fb.group({
      name:        ['', Validators.required],
      dosage:      [''],
      frequency:   ['1-1-1', Validators.required],
      duration:    ['5 days', Validators.required],
      instructions:['After food'],
      routeOfAdmin:['oral'],
    });
  }

  addMedicine():           void { this.medicines.push(this.newMedicine()); }
  removeMedicine(i: number): void { if (this.medicines.length > 1) this.medicines.removeAt(i); }

  // ── Voice — single field capture (per-field mic buttons) ────────
  captureFieldVoice(field: string, medIndex?: number): void {
    this.voice.captureOnce(this.selectedLanguage).subscribe({
      next: transcript => {
        if (field === 'diagnosis')     this.form.patchValue({ diagnosis: transcript });
        else if (field === 'symptoms') this.form.patchValue({ symptoms: this.formatSymptoms(transcript) });
        else if (field === 'advice')   this.form.patchValue({ advices: transcript });
        else if (field === 'med-name' && medIndex !== undefined)
          this.medicines.at(medIndex).patchValue({ name: transcript });
      },
    });
  }

  // ── Voice — Speak Rx (global continuous capture) ────────────────
  startRxVoice(): void {
    this.stopRxVoice();
    this.isRxVoiceActive = true;
    this.rxTranscript    = '';
    this.rxActiveSection = null;
    this.voice.clearTranscript();

    // 1 — Interim: highlight the section the doctor is about to fill
    // Only update when a section IS detected — never clear to null mid-speech
    this.rxInterimSub = this.voice.interim$.subscribe(interim => {
      if (!this.isRxVoiceActive || !interim) return;
      const section = this.detectRxSection(interim);
      if (section) { this.rxActiveSection = section; this.rxPendingSection = section; }
    });

    // 2 — Final segment: parse and fill fields in real time
    this.rxSegmentSub = this.voice.finalSegment$.subscribe(seg => {
      if (!this.isRxVoiceActive) return;
      this.rxTranscript += (this.rxTranscript ? ' ' : '') + seg;

      if (this.voice.detectSaveCommand(seg)) {
        this.stopRxVoice();
        setTimeout(() => this.submit(), 500);
        return;
      }
      this.applyRxSegment(seg);
    });

    // 3 — Pause recovery (same pattern as patient registration)
    this.rxListenSub = this.voice.isListening$.pipe(skip(1)).subscribe(listening => {
      if (listening || !this.isRxVoiceActive) return;
      if (this.rxRestartCount < this.RX_MAX) {
        this.rxRestartCount++;
        setTimeout(() => {
          if (this.isRxVoiceActive) this.voice.restartContinuous(this.selectedLanguage);
        }, 300);
      } else {
        this.stopRxVoice();
      }
    });

    this.voice.start(this.selectedLanguage);
  }

  stopRxVoice(): void {
    this.rxSegmentSub?.unsubscribe();
    this.rxInterimSub?.unsubscribe();
    this.rxListenSub?.unsubscribe();
    this.voice.stop();
    this.isRxVoiceActive  = false;
    this.rxActiveSection  = null;
    this.rxPendingSection = null;
    this.rxRestartCount   = 0;
  }

  // ── Section detection from interim text ────────────────────────
  detectRxSection(text: string): string | null {
    const t = text.toLowerCase();
    if (/\b(diagnosis|diagnose)\b/.test(t))                         return 'diagnosis';
    if (/\b(symptom|symptoms|presenting)\b/.test(t))                return 'symptoms';
    if (/\b(medicine|drug|tablet|tab|capsule|cap|syrup|syr|inj)\b/.test(t)) return 'medicines';
    if (/\b(advice|advise)\b/.test(t))                              return 'advice';
    if (/\b(follow\s*up|review|next\s*visit)\b/.test(t))            return 'followup';
    if (/\b(fee|charges|consultation)\b/.test(t))                   return 'payment';
    if (/\b(cash|upi|card|online|paid|pending|waived)\b/.test(t))   return 'payment';
    if (/\b(clinical\s*notes?|notes?|examination)\b/.test(t))       return 'clinical';
    return null;
  }

  // ── Apply a finalized speech segment to the form ────────────────
  applyRxSegment(raw: string): void {
    const t   = raw.toLowerCase().replace(/\bcolon\b/gi, ':').trim();
    const set = (section: string) => {
      this.rxVoiceFilled.add(section);
      this.rxActiveSection  = section;   // stays highlighted until next section is spoken
      this.rxPendingSection = null;
    };

    // ── Payment mode / status (no label needed)
    const modeM   = t.match(/\b(cash|upi|card|online)\b/);
    const statusM = t.match(/\b(paid|pending|waived)\b/);
    if (modeM || statusM) {
      if (modeM)   this.form.patchValue({ paymentMode: modeM[1] });
      if (statusM) this.form.patchValue({ paymentStatus: statusM[1] });
      set('payment'); return;
    }

    // ── Fee
    const feeM = t.match(/\b(?:fee|charges?|consultation\s*fee)\s*:?\s*(\d+)/);
    if (feeM) { this.form.patchValue({ consultationFee: parseInt(feeM[1]) }); set('payment'); return; }

    // ── Follow-up keyword
    if (/\b(follow\s*up|review|next\s*visit)\b/.test(t)) {
      const dateStr = this.parseFollowUpDate(t);
      if (dateStr) { this.form.patchValue({ followUpDate: dateStr }); set('followup'); }
      else { this.rxPendingSection = 'followup'; this.rxActiveSection = 'followup'; }
      return;
    }

    // ── Advice
    if (/\b(?:advice|advise)\b/i.test(raw)) {
      const advM = /\b(?:advice|advise)\s*:?\s*(.+)/i.exec(raw);
      if (advM?.[ 1]?.trim()) {
        const existing = this.form.value.advices?.trim();
        const line = advM[1].trim();
        this.form.patchValue({ advices: existing ? `${existing}\n${line}` : line });
        set('advice');
      } else { this.rxPendingSection = 'advice'; this.rxActiveSection = 'advice'; }
      return;
    }

    // ── Clinical notes
    if (/\b(?:clinical\s*notes?|notes?|examination)\b/i.test(raw)) {
      const notesM = /\b(?:clinical\s*notes?|notes?|examination)\s*:?\s*(.+)/i.exec(raw);
      const notesVal = notesM?.[1]?.trim();
      if (notesVal && notesVal.length >= 2) { this.form.patchValue({ clinicalNotes: notesVal }); set('clinical'); }
      else { this.rxPendingSection = 'clinical'; this.rxActiveSection = 'clinical'; }
      return;
    }

    // ── Symptoms
    if (/\b(?:symptoms?|presenting\s*with)\b/i.test(raw)) {
      const sympM = /\b(?:symptoms?|presenting\s*with)\s*:?\s*(.+)/i.exec(raw);
      const sympVal = sympM?.[1]?.trim();
      if (sympVal && sympVal.length >= 2) { this.form.patchValue({ symptoms: this.formatSymptoms(sympVal) }); set('symptoms'); }
      else { this.rxPendingSection = 'symptoms'; this.rxActiveSection = 'symptoms'; }
      return;
    }

    // ── Diagnosis
    if (/\b(?:diagnosis|diagnose)\b/i.test(raw)) {
      const diagM = /\b(?:diagnosis|diagnose)\s*:?\s*(.+)/i.exec(raw);
      if (diagM?.[1]?.trim()) { this.form.patchValue({ diagnosis: diagM[1].trim() }); set('diagnosis'); }
      else { this.rxPendingSection = 'diagnosis'; this.rxActiveSection = 'diagnosis'; }
      return;
    }

    // ── Medicine keyword — MUST be before pending-section flush so "medicine X"
    // never accidentally lands in a previously-pending symptoms/clinical field
    if (/\b(medicine|drug|tablet|tab|capsule|cap|syrup|syr|inj|injection)\b/i.test(raw)) {
      const stripped = raw
        .replace(/\b(medicine|drug|tablet|tab|capsule|cap|syrup|syr|inj|injection)\s*(?:\d+\s*)?:?\s*/i, '')
        .trim();
      if (stripped.length >= 2) {
        const parsed = this.parseMedicine(stripped);
        if (parsed.name) {
          let idx = -1;
          for (let i = 0; i < this.medicines.length; i++) {
            if (!this.medicines.at(i).get('name')?.value) { idx = i; break; }
          }
          if (idx === -1) { this.addMedicine(); idx = this.medicines.length - 1; }
          this.medicines.at(idx).patchValue(parsed);
          set('medicines');
        }
      } else {
        // Keyword only — wait for the name/details in the next utterance
        this.rxPendingSection = 'medicines';
        this.rxActiveSection  = 'medicines';
      }
      return;
    }

    // ── No keyword — flush into pending section (ignore single-char spurious finals)
    if (this.rxPendingSection && raw.trim().length >= 2) {
      this.applyToSection(this.rxPendingSection, raw.trim());
      set(this.rxPendingSection);
    }
  }

  private formatSymptoms(raw: string): string {
    const clean = (tokens: string[]) =>
      tokens.map(s => s.trim()).filter(s => s.length >= 2).join(', ');
    if (raw.includes(',')) return clean(raw.split(','));
    // No commas — split on "and" / spaces: "fever cough headache" → "fever, cough, headache"
    return clean(raw.replace(/\s+and\s+/gi, ' ').split(/\s+/));
  }

  private applyToSection(section: string, value: string): void {
    if (!value || value.trim().length < 2) return;
    switch (section) {
      case 'diagnosis': this.form.patchValue({ diagnosis: value }); break;
      case 'symptoms':  this.form.patchValue({ symptoms: this.formatSymptoms(value) }); break;
      case 'clinical':  this.form.patchValue({ clinicalNotes: value }); break;
      case 'advice': {
        const ex = this.form.value.advices?.trim();
        this.form.patchValue({ advices: ex ? `${ex}\n${value}` : value }); break;
      }
      case 'followup': {
        const d = this.parseFollowUpDate(value);
        if (d) this.form.patchValue({ followUpDate: d }); break;
      }
      case 'medicines': {
        const parsed = this.parseMedicine(value);
        if (parsed.name) {
          let idx = -1;
          for (let i = 0; i < this.medicines.length; i++) {
            if (!this.medicines.at(i).get('name')?.value) { idx = i; break; }
          }
          if (idx === -1) { this.addMedicine(); idx = this.medicines.length - 1; }
          this.medicines.at(idx).patchValue(parsed);
        }
        break;
      }
      case 'payment': {
        const modeM   = value.match(/\b(cash|upi|card|online)\b/i);
        const statusM = value.match(/\b(paid|pending|waived)\b/i);
        const feeM    = value.match(/\d+/);
        if (modeM)   this.form.patchValue({ paymentMode: modeM[1].toLowerCase() });
        if (statusM) this.form.patchValue({ paymentStatus: statusM[1].toLowerCase() });
        if (feeM && !modeM && !statusM) this.form.patchValue({ consultationFee: parseInt(feeM[0]) });
        break;
      }
    }
  }

  // ── Medicine text parser ─────────────────────────────────────────
  parseMedicine(raw: string): Partial<{ name: string; dosage: string; frequency: string; duration: string; instructions: string; routeOfAdmin: string }> {
    const med: any = { routeOfAdmin: 'oral' };
    let r = raw;

    // Instructions (match longest first)
    const INSTR = [
      'after food','before food','with food','empty stomach','before meal','after meal',
      'before bed','at bedtime','bedtime','with water','with milk','after breakfast',
      'before breakfast','after dinner','before dinner',
    ];
    for (const instr of INSTR) {
      const re = new RegExp(`\\b${instr.replace(/ /g,'\\s+')}\\b`, 'gi');
      if (re.test(r)) {
        med.instructions = instr.charAt(0).toUpperCase() + instr.slice(1);
        r = r.replace(re, ' ');
        break;
      }
    }

    // Route of administration
    if (/\b(topical|cream|ointment|gel)\b/i.test(r))   { med.routeOfAdmin = 'topical';    r = r.replace(/\b(topical|cream|ointment|gel)\b/gi, ' '); }
    else if (/\b(injection|inj|im|iv)\b/i.test(r))     { med.routeOfAdmin = 'injection';  r = r.replace(/\b(injection|inj|im|iv)\b/gi, ' '); }
    else if (/\b(inhal|inhaler|nebul)\b/i.test(r))     { med.routeOfAdmin = 'inhalation'; r = r.replace(/\b(inhal\w*|nebul\w*)\b/gi, ' '); }

    // Frequency (longest patterns first)
    const FREQ: [RegExp, string][] = [
      [/\bthree\s+times\s+(a\s+)?day\b/i,  'Thrice daily'],
      [/\bthrice\s*(daily|a\s*day)?\b/i,   'Thrice daily'],
      [/\btds\b/i,                          'Thrice daily'],
      [/\btwice\s*(daily|a\s*day)?\b/i,    'Twice daily'],
      [/\btwo\s+times\s+(a\s+)?day\b/i,    'Twice daily'],
      [/\bbd\b/i,                           'Twice daily'],
      [/\bonce\s*(daily|a\s*day)?\b/i,     'Once daily'],
      [/\bod\b/i,                           'Once daily'],
      [/\bsos\b/i,                          'SOS'],
      [/\bas\s+needed\b/i,                  'SOS'],
      [/\bwhen\s+needed\b/i,                'SOS'],
      [/\bmorning\s+(and\s+)?evening\b/i,  '1-0-1'],
      [/\bmorning\s+(and\s+)?night\b/i,    '1-0-1'],
      [/\bmorning\s+only\b/i,              '1-0-0'],
      [/\bnight\s+only\b/i,               '0-0-1'],
      [/\b1-1-1\b/,                        '1-1-1'],
      [/\b1-0-1\b/,                        '1-0-1'],
      [/\b1-0-0\b/,                        '1-0-0'],
      [/\b0-0-1\b/,                        '0-0-1'],
      [/\b0-1-0\b/,                        '0-1-0'],
    ];
    for (const [re, val] of FREQ) {
      if (re.test(r)) { med.frequency = val; r = r.replace(re, ' '); break; }
    }

    // Duration (convert word-numbers first)
    const WN: Record<string, number> = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,fourteen:14,fifteen:15,twenty:20,thirty:30 };
    let rn = r;
    for (const [w, n] of Object.entries(WN)) rn = rn.replace(new RegExp(`\\b${w}\\b`, 'gi'), String(n));

    if (/\bongoing\b/i.test(rn))        { med.duration = 'Ongoing'; r = r.replace(/\bongoing\b/gi, ' '); }
    else {
      const durM = rn.match(/\b(\d+)\s*(day|days|week|weeks|month|months)\b/i);
      if (durM) {
        const n    = parseInt(durM[1]);
        const unit = durM[2].toLowerCase();
        if (unit.startsWith('day'))   med.duration = `${n} ${n === 1 ? 'day' : 'days'}`;
        else if (unit.startsWith('week'))  med.duration = `${n * 7} days`;
        else if (unit.startsWith('month')) med.duration = `${n} ${n === 1 ? 'month' : 'months'}`;
        r = r.replace(durM[0], ' ');
      }
    }

    // Dosage: Xmg / Xml / Xg / Xmcg / Xiu
    const dosM = r.match(/\b(\d+(?:\.\d+)?)\s*(mg|ml|mcg|g\b|iu|units?)\b/i);
    if (dosM) { med.dosage = dosM[0].replace(/\s+/, ''); r = r.replace(dosM[0], ' '); }

    // Name: whatever is left
    const name = r.replace(/\s+/g, ' ').trim().replace(/^[^a-zA-Zऀ-ॿ]+/, '').replace(/[^a-zA-Zऀ-ॿ]+$/, '');
    if (name.length >= 2) med.name = name.charAt(0).toUpperCase() + name.slice(1);

    return med;
  }

  // ── Follow-up date parser ────────────────────────────────────────
  parseFollowUpDate(text: string): string {
    const t = text.toLowerCase();
    const WN: Record<string, number> = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10 };
    let rn = t;
    for (const [w, n] of Object.entries(WN)) rn = rn.replace(new RegExp(`\\b${w}\\b`, 'gi'), String(n));

    const afterM = rn.match(/\b(\d+)\s*(day|days|week|weeks|month|months)\b/);
    if (afterM) {
      const n    = parseInt(afterM[1]);
      const unit = afterM[2];
      const ms   = unit.startsWith('day')   ? n * 86400000
                 : unit.startsWith('week')  ? n * 7 * 86400000
                 : n * 30 * 86400000;
      return new Date(Date.now() + ms).toISOString().split('T')[0];
    }
    return '';
  }

  // ── Submit ───────────────────────────────────────────────────────
  submit(): void {
    if (!this.patientId) {
      this.toast.error('Please select a patient first');
      return;
    }
    // Check medicine names
    const emptyMed = (this.form.get('medicines') as any).controls
      .findIndex((g: any) => !g.get('name')?.value?.trim());
    if (emptyMed !== -1) {
      this.form.markAllAsTouched();
      this.toast.error(`Medicine #${emptyMed + 1} name is required`);
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Please fill all required fields');
      return;
    }
    this.loading = true;
    const v = this.form.value;
    this.rxService.createPrescription({
      patientId:       this.patientId,
      tokenId:         this.tokenId || undefined,
      diagnosis:       v.diagnosis,
      symptoms:        v.symptoms ? v.symptoms.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      medicines:       v.medicines,
      advices:         v.advices  ? v.advices.split('\n').filter((a: string) => a.trim())              : [],
      followUpDate:    v.followUpDate || undefined,
      consultationFee: +v.consultationFee,
      paymentStatus:   v.paymentStatus,
      paymentMode:     v.paymentMode,
      clinicalNotes:   v.clinicalNotes,
    }).subscribe({
      next: res => {
        this.toast.success(`Prescription ${res.data.prescriptionNumber} created`);
        this.router.navigate(['/prescriptions']);
      },
      error: () => { this.loading = false; },
    });
  }

  isActive(section: string): boolean { return this.rxActiveSection === section; }
  isFilled(section: string): boolean { return this.rxVoiceFilled.has(section); }
}
