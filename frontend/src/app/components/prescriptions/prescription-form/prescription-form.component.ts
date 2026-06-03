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
      if (sympVal && sympVal.length >= 2) {
        this.form.patchValue({ symptoms: this.formatSymptoms(sympVal) });
        set('symptoms');
        this.triggerAiRecommend();
      } else { this.rxPendingSection = 'symptoms'; this.rxActiveSection = 'symptoms'; }
      return;
    }

    // ── Diagnosis
    if (/\b(?:diagnosis|diagnose)\b/i.test(raw)) {
      const diagM = /\b(?:diagnosis|diagnose)\s*:?\s*(.+)/i.exec(raw);
      if (diagM?.[1]?.trim()) {
        this.form.patchValue({ diagnosis: diagM[1].trim() });
        set('diagnosis');
        this.triggerAiRecommend();
      } else { this.rxPendingSection = 'diagnosis'; this.rxActiveSection = 'diagnosis'; }
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
      case 'diagnosis': this.form.patchValue({ diagnosis: value }); this.triggerAiRecommend(); break;
      case 'symptoms':  this.form.patchValue({ symptoms: this.formatSymptoms(value) }); this.triggerAiRecommend(); break;
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

    // ── Word-number map (used for dosage + duration) ──────────────
    const WN: Record<string, string> = {
      zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',
      six:'6',seven:'7',eight:'8',nine:'9',ten:'10',
      eleven:'11',twelve:'12',fourteen:'14',fifteen:'15',
      twenty:'20',thirty:'30',forty:'40',fifty:'50',
      hundred:'100', 'five hundred':'500', 'two fifty':'250',
      एक:'1', दोन:'2', तीन:'3', चार:'4', पाच:'5',
      सहा:'6', सात:'7', आठ:'8', नऊ:'9', दहा:'10',
    };
    const toNum = (s: string) => {
      let out = s;
      for (const [w, n] of Object.entries(WN))
        out = out.replace(new RegExp(`\\b${w}\\b`, 'gi'), n);
      return out;
    };

    // ── Instructions ─────────────────────────────────────────────
    const INSTR: [RegExp, string][] = [
      [/\b(after\s+food|after\s+meal|after\s+eating|khane\s+ke\s+baad|jevan\s+nanthar|जेवणानंतर)\b/i, 'After food'],
      [/\b(before\s+food|before\s+meal|khane\s+se\s+pehle|jevan\s+puri|जेवणाआधी)\b/i,                 'Before food'],
      [/\b(with\s+food|with\s+meals?)\b/i,                                                              'With food'],
      [/\b(empty\s+stomach|on\s+empty\s+stomach|rikam\s+pot|रिकाम्या\s+पोटी)\b/i,                     'Empty stomach'],
      [/\b(after\s+breakfast)\b/i,                                                                      'After breakfast'],
      [/\b(before\s+breakfast)\b/i,                                                                     'Before breakfast'],
      [/\b(after\s+dinner|after\s+supper)\b/i,                                                          'After dinner'],
      [/\b(before\s+dinner|before\s+supper)\b/i,                                                        'Before dinner'],
      [/\b(at\s+bedtime|before\s+bed|bedtime|at\s+night|night\s+time|ratri|रात्री)\b/i,                'At bedtime'],
      [/\b(with\s+water|with\s+milk|with\s+warm\s+water)\b/i,                                           'With water'],
    ];
    for (const [re, label] of INSTR) {
      if (re.test(r)) { med.instructions = label; r = r.replace(re, ' '); break; }
    }

    // ── Route of administration ───────────────────────────────────
    if (/\b(topical|cream|ointment|gel|lotion|मलम)\b/i.test(r)) {
      med.routeOfAdmin = 'topical';
      r = r.replace(/\b(topical|cream|ointment|gel|lotion|मलम)\b/gi, ' ');
    } else if (/\b(injection|inj|im\b|iv\b|intramuscular|intravenous|इंजेक्शन)\b/i.test(r)) {
      med.routeOfAdmin = 'injection';
      r = r.replace(/\b(injection|inj|im\b|iv\b|intramuscular|intravenous|इंजेक्शन)\b/gi, ' ');
    } else if (/\b(inhaler?|inhal\w*|nebuliz\w*|puff|पफ)\b/i.test(r)) {
      med.routeOfAdmin = 'inhalation';
      r = r.replace(/\b(inhaler?|inhal\w*|nebuliz\w*|puff|पफ)\b/gi, ' ');
    } else if (/\b(eye\s+drop|ear\s+drop|nasal\s+spray|nasal\s+drop|drop)\b/i.test(r)) {
      med.routeOfAdmin = 'other';
      r = r.replace(/\b(eye\s+drops?|ear\s+drops?|nasal\s+spray|nasal\s+drops?|drops?)\b/gi, ' ');
    }

    // ── Frequency (longest/most-specific first) ───────────────────
    const FREQ: [RegExp, string][] = [
      // 1-1-1
      [/\b(morning\s+afternoon\s+evening|morning\s+noon\s+night|morning\s+afternoon\s+night|three\s+times|teen\s+vela|तीन\s+वेळा|din\s+mein\s+teen\s+baar|तीनदा)\b/i, '1-1-1'],
      [/\b(thrice\s*(daily|a\s*day)?|tds|tid)\b/i, 'Thrice daily'],
      [/\bthree\s+times\s+(a\s+)?day\b/i,           'Thrice daily'],
      // 1-0-1
      [/\b(morning\s+(and\s+)?evening|morning\s+(and\s+)?night|subah\s+sham|subah\s+raat|दोन\s+वेळा\s*-?\s*सकाळ|सकाळ\s+संध्याकाळ)\b/i, '1-0-1'],
      // Twice daily
      [/\b(twice\s*(daily|a\s*day)?|bd\b|two\s+times\s+(a\s+)?day|don\s+vela|दोनदा|दोन\s+वेळा)\b/i, 'Twice daily'],
      // Once daily
      [/\b(once\s*(daily|a\s*day)?|od\b|one\s+time|ek\s+vela|एकदा|एक\s+वेळा|roj\s+ek)\b/i,         'Once daily'],
      // Morning only
      [/\b(morning\s+only|only\s+morning|morning\s+dose|subah|सकाळी\s+एकदा|सकाळी)\b/i,              '1-0-0'],
      // Night only
      [/\b(night\s+only|only\s+at\s+night|bedtime\s+only|ratri|रात्री\s+एकदा)\b/i,                  '0-0-1'],
      // SOS
      [/\b(sos|as\s+needed|when\s+needed|prn|if\s+required|गरज\s+असेल\s+तेव्हा)\b/i,               'SOS'],
      // Numeric patterns
      [/\b1[-–]1[-–]1\b/,   '1-1-1'],
      [/\b1[-–]0[-–]1\b/,   '1-0-1'],
      [/\b1[-–]1[-–]0\b/,   '1-1-0'],
      [/\b0[-–]1[-–]1\b/,   '0-1-1'],
      [/\b1[-–]0[-–]0\b/,   '1-0-0'],
      [/\b0[-–]0[-–]1\b/,   '0-0-1'],
      [/\b0[-–]1[-–]0\b/,   '0-1-0'],
    ];
    for (const [re, val] of FREQ) {
      if (re.test(r)) { med.frequency = val; r = r.replace(re, ' '); break; }
    }

    // ── Duration ──────────────────────────────────────────────────
    let rn = toNum(r);
    if (/\b(ongoing|continue|lifelong|niyamit|नियमित|आजीवन)\b/i.test(rn)) {
      med.duration = 'Ongoing';
      r = r.replace(/\b(ongoing|continue|lifelong|niyamit|नियमित|आजीवन)\b/gi, ' ');
    } else {
      const durM = rn.match(/\b(\d+)\s*(day|days|divas|दिवस|week|weeks|month|months|mahina|महिना)\b/i);
      if (durM) {
        const n = parseInt(durM[1]);
        const u = durM[2].toLowerCase();
        if (/^(day|divas|दिवस)/.test(u))         med.duration = `${n} ${n === 1 ? 'day' : 'days'}`;
        else if (/^week/.test(u))                 med.duration = `${n * 7} days`;
        else if (/^(month|mahina|महिना)/.test(u)) med.duration = `${n} ${n === 1 ? 'month' : 'months'}`;
        r = r.replace(durM[0], ' ');
      }
    }

    // ── Dosage ────────────────────────────────────────────────────
    // Convert word-numbers first then match units
    let rd = toNum(r);
    const dosM = rd.match(/\b(\d+(?:\.\d+)?)\s*(mg|milligram\w*|ml|milliliter\w*|mcg|microgram\w*|g\b|gram\w*|iu|units?|tab\w*|cap\w*|puff\w*|drop\w*|sachet\w*|lozenge\w*)\b/i);
    if (dosM) {
      // Normalise unit
      const unit = dosM[2].toLowerCase();
      const normUnit = unit.startsWith('millig') ? 'mg'
                     : unit.startsWith('millil') ? 'ml'
                     : unit.startsWith('microg') ? 'mcg'
                     : unit.startsWith('gram')   ? 'g'
                     : unit.startsWith('tab')    ? 'tab'
                     : unit.startsWith('cap')    ? 'cap'
                     : unit.startsWith('puff')   ? 'puff'
                     : unit.startsWith('drop')   ? 'drops'
                     : unit.startsWith('sachet') ? 'sachet'
                     : unit;
      med.dosage = `${dosM[1]}${normUnit}`;
      r = r.replace(dosM[0], ' ');
    }

    // ── Name: whatever is left ────────────────────────────────────
    const name = r.replace(/\s+/g, ' ').trim()
                  .replace(/^[^a-zA-Zऀ-ॿ]+/, '')
                  .replace(/[^a-zA-Zऀ-ॿ]+$/, '');
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
