import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class VoiceService {
  constructor(private ngZone: NgZone) {}
  private recognition: any;
  private _isListening$    = new BehaviorSubject<boolean>(false);
  private _transcript$     = new BehaviorSubject<string>('');
  private _error$          = new BehaviorSubject<string>('');
  private _finalSegment$   = new Subject<string>();
  private _interim$        = new BehaviorSubject<string>('');
  private accumulatedTranscript = '';

  isListening$   = this._isListening$.asObservable();
  transcript$    = this._transcript$.asObservable();
  error$         = this._error$.asObservable();
  /** Each finalized speech segment (isFinal=true) during continuous capture */
  finalSegment$  = this._finalSegment$.asObservable();
  /** The current in-progress (interim) speech chunk — resets between sentences */
  interim$       = this._interim$.asObservable();

  get isListening(): boolean { return this._isListening$.value; }
  get currentTranscript(): string { return this._transcript$.value; }

  get isSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  private buildRecognition(language: 'marathi' | 'hindi' | 'english', continuous: boolean): any {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    const langMap: Record<string, string> = { marathi: 'mr-IN', hindi: 'hi-IN', english: 'en-IN' };
    rec.lang = langMap[language] || 'en-IN';
    rec.continuous = continuous;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    return rec;
  }

  // ── Continuous capture ──────────────────────────────────────────

  // Fresh start — clears accumulated transcript
  start(language: 'marathi' | 'hindi' | 'english' = 'english'): void {
    if (!this.isSupported) { this._error$.next('Speech recognition not supported.'); return; }
    this.accumulatedTranscript = '';
    this._transcript$.next('');
    this._error$.next('');
    this.startContinuous(language);
  }

  // Resume after pause — KEEPS accumulated transcript so words before
  // the pause are not lost
  restartContinuous(language: 'marathi' | 'hindi' | 'english' = 'english'): void {
    if (!this.isSupported) return;
    this._error$.next('');
    this.startContinuous(language);
  }

  private startContinuous(language: 'marathi' | 'hindi' | 'english'): void {
    this.recognition = this.buildRecognition(language, true);
    this.recognition.onstart  = () => this.ngZone.run(() => this._isListening$.next(true));
    this.recognition.onend    = () => this.ngZone.run(() => this._isListening$.next(false));
    this.recognition.onerror  = (e: any) => this.ngZone.run(() => {
      // 'aborted' = we stopped it manually; 'no-speech' = silence — neither is an error
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        this._error$.next(`Mic error: ${e.error}`);
      }
      this._isListening$.next(false);
    });
    this.recognition.onresult = (event: any) => this.ngZone.run(() => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const seg = event.results[i][0].transcript;
          this.accumulatedTranscript += seg + ' ';
          this._interim$.next('');          // clear interim — sentence is done
          this._finalSegment$.next(seg.trim());
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      this._interim$.next(interim);         // live in-progress speech
      this._transcript$.next((this.accumulatedTranscript + interim).trim());
    });
    try { this.recognition.start(); }
    catch { this.recognition.stop(); setTimeout(() => this.recognition.start(), 300); }
  }

  stop(): void {
    this.recognition?.stop();
    this._isListening$.next(false);
  }

  clearTranscript(): void {
    this.accumulatedTranscript = '';
    this._transcript$.next('');
    this._interim$.next('');
    this._error$.next('');
  }

  // Single-shot capture for per-field mic button
  captureOnce(language: 'marathi' | 'hindi' | 'english' = 'english'): Observable<string> {
    if (!this.isSupported) {
      this._error$.next('Speech recognition not supported.');
      return new Observable(o => o.error('not-supported'));
    }
    return new Observable(observer => {
      const rec = this.buildRecognition(language, false);
      rec.onstart  = () => this.ngZone.run(() => this._isListening$.next(true));
      rec.onend    = () => this.ngZone.run(() => this._isListening$.next(false));
      rec.onerror  = (e: any) => this.ngZone.run(() => {
        this._isListening$.next(false);
        if (e.error === 'no-speech') {
          // Silence — not a real error; let the user try again without an alert
          observer.complete();
        } else {
          this._error$.next(`Error: ${e.error}`);
          observer.error(e.error);
        }
      });
      rec.onresult = (event: any) => this.ngZone.run(() => {
        let interim = '';
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const text = event.results[i][0].transcript.trim();
            this._transcript$.next(text);
            observer.next(text);
            observer.complete();
            return;
          }
          interim += event.results[i][0].transcript;
        }
        this._transcript$.next(interim);
      });
      this._transcript$.next('');
      this._error$.next('');
      rec.start();
      return () => { try { rec.stop(); } catch {} };
    });
  }

  // Returns the last field label the user mentioned in the current (interim) transcript.
  // Used to highlight which field is being spoken about in real time.
  detectActiveField(transcript: string): string | null {
    const t = transcript.toLowerCase().replace(/\bcolon\b/gi, ':');
    const LABELS: { key: string; re: RegExp }[] = [
      { key: 'chiefComplaint', re: /\b(?:chief\s+complaint|complaint|problem|issue|takrar)\b/gi },
      { key: 'name',           re: /\b(?:patient\s+name|patient|name|naam)\b/gi },
      { key: 'age',            re: /\baged?\b/gi },
      { key: 'gender',         re: /\b(?:gender|sex|ling)\b/gi },
      { key: 'phone',          re: /\b(?:phone\s+number|mobile\s+number|phone|mobile|mob|contact|number)\b/gi },
    ];
    let lastField: string | null = null;
    let lastIndex = -1;
    for (const { key, re } of LABELS) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(t)) !== null) {
        if (m.index > lastIndex) { lastIndex = m.index; lastField = key; }
      }
    }
    return lastField;
  }

  // Returns true when the spoken text contains a save/submit command.
  detectSaveCommand(transcript: string): boolean {
    return /\b(save\s+patient|save|submit|register\s+patient|register|done|finish|complete)\b/i.test(transcript);
  }

  // Parse all patient fields from a transcript where the user speaks
  // field labels before values, e.g.:
  //   "patient name Shaggy Pawar, age 35, gender male, phone 9876543210, complaint fever"
  // Falls back to positional parsing if no labels are detected.
  parseAll(transcript: string): {
    name?: string; age?: number; gender?: 'male' | 'female' | 'other';
    phone?: string; chiefComplaint?: string;
  } {
    // Replace spoken "colon" with the punctuation mark
    const t = transcript.replace(/\bcolon\b/gi, ':');

    // Label patterns — longer/more-specific first to avoid partial shadowing.
    // Each pattern matches the label + optional whitespace/colon separator.
    const LABELS: { key: string; re: RegExp }[] = [
      { key: 'chiefComplaint', re: /\b(?:chief\s+complaint|chief complaint|complaint|problem|issue|takrar|taqrar|तक्रार|समस्या)\s*:?\s*/i },
      { key: 'name',           re: /\b(?:patient\s+name|patient name|patient|name|naam|नाव|नाम)\s*:?\s*/i },
      { key: 'age',            re: /\b(?:age|umar|vay|वय|उम्र)\s*:?\s*/i },
      { key: 'gender',         re: /\b(?:gender|sex|ling|लिंग)\s*:?\s*/i },
      { key: 'phone',          re: /\b(?:phone\s+number|mobile\s+number|contact\s+number|phone|mobile|mob|contact|number|फोन|मोबाइल)\s*:?\s*/i },
    ];

    // Locate each label in the transcript
    const hits: { key: string; start: number; valueStart: number }[] = [];
    for (const { key, re } of LABELS) {
      const m = re.exec(t);
      if (m) hits.push({ key, start: m.index, valueStart: m.index + m[0].length });
    }

    // No labels found — use legacy positional parser as fallback
    if (hits.length === 0) return this.parseAllPositional(transcript);

    hits.sort((a, b) => a.start - b.start);

    const result: any = {};
    for (let i = 0; i < hits.length; i++) {
      const valueEnd = i + 1 < hits.length ? hits[i + 1].start : t.length;
      const raw = t.substring(hits[i].valueStart, valueEnd)
                    .replace(/[,;\s]+$/, '').trim();

      switch (hits[i].key) {
        case 'age': {
          const ageM = raw.match(/\d+/);
          const n = ageM ? parseInt(ageM[0]) : NaN;
          if (!isNaN(n) && n >= 1 && n <= 150) result.age = n;
          break;
        }
        case 'gender': {
          const g = raw.toLowerCase();
          result.gender = /\b(female|woman|girl|महिला|श्रीमती)\b/.test(g) ? 'female'
                        : /\bother\b/.test(g) ? 'other' : 'male';
          break;
        }
        case 'phone': {
          const digits = raw.replace(/\D/g, '');
          if (digits.length >= 10) result.phone = digits.slice(-10);
          break;
        }
        default:
          if (raw.length >= 1) result[hits[i].key] = raw;
      }
    }
    return result;
  }

  // Legacy positional parser — used as fallback when no field labels are spoken.
  private parseAllPositional(transcript: string): {
    name?: string; age?: number; gender?: 'male' | 'female' | 'other';
    phone?: string; chiefComplaint?: string;
  } {
    const result: any = {};
    let w = transcript;

    const phoneStrict = w.match(/\b(\d{10})\b/);
    const phoneLoose  = phoneStrict ? null : w.match(/\b(\d[\d ]{8,18}\d)\b/);
    const phoneMatch  = phoneStrict || phoneLoose;
    if (phoneMatch) {
      const digits = phoneMatch[1].replace(/\s+/g, '');
      if (digits.length === 10) { result.phone = digits; w = w.replace(phoneMatch[0], ' '); }
    }

    const genderM = w.match(/\b(female|woman|girl|महिला|श्रीमती|male|mail|man|boy|पुरुष|श्री|other)\b/i);
    if (genderM) {
      const gw = genderM[1].toLowerCase();
      result.gender = /^(female|woman|girl|महिला|श्रीमती)$/.test(gw) ? 'female'
                    : gw === 'other' ? 'other' : 'male';
      w = w.replace(genderM[0], ' ');
    }

    const ageExplicit = w.match(/\b(?:age[d]?\s+|उम्र\s+|वय\s+)(\d{1,3})\b/i)
                     || w.match(/\b(\d{1,3})\s*(?:years?|yr|yrs|वर्ष|साल)\b/i);
    if (ageExplicit) {
      result.age = parseInt(ageExplicit[1]);
      w = w.replace(ageExplicit[0], ' ');
    } else {
      const ageAny = w.match(/\b(\d{1,3})\b/);
      if (ageAny) {
        const n = parseInt(ageAny[1]);
        if (n >= 1 && n <= 120) { result.age = n; w = w.replace(ageAny[0], ' '); }
      }
    }

    w = w.replace(/\b(age[d]?|patient|new|name|is|phone|mobile|mob|and|the|a|or)\b/gi, ' ')
         .replace(/[,;:.]/g, ' ').replace(/\s+/g, ' ').trim();

    const COMPLAINTS = /\b(fever|cough|cold|pain|headache|vomit|nausea|diarrhea|chest|stomach|throat|back|knee|joint|allergy|rash|skin|eye|ear|tooth|infection|weakness|fatigue|dizz|breathless|swelling|wound|injury|bp|sugar|diabetes|hypertension|migraine|ताप|खोकला|दुखणे|चक्कर)\b/i;
    const ci = w.search(COMPLAINTS);
    if (ci > 0) {
      const namePart = this.cleanName(w.substring(0, ci));
      if (namePart.length >= 2) result.name = namePart;
      result.chiefComplaint = w.substring(ci).trim();
    } else if (ci === 0) {
      result.chiefComplaint = w;
    } else {
      const words = w.split(/\s+/).filter(Boolean);
      if (words.length >= 1 && words.length <= 3) {
        const cleaned = this.cleanName(w);
        if (cleaned.length >= 2) result.name = cleaned;
      } else if (words.length > 3) {
        result.name = this.cleanName(words.slice(0, 2).join(' '));
        result.chiefComplaint = words.slice(2).join(' ');
      }
    }
    return result;
  }

  private cleanName(raw: string): string {
    return raw
      .replace(/\b(female|woman|girl|महिला|male|mail|man|boy|पुरुष|other)\b/gi, '')
      .replace(/\d+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Parse a single field value from spoken text
  parseField(field: string, transcript: string): any {
    const t = transcript.toLowerCase().trim();
    switch (field) {
      case 'name':
        return transcript.replace(/^(?:patient\s+|name\s*(?:is\s+)?)/i, '').trim() || null;
      case 'age': {
        const m = t.match(/\d+/);
        return m ? parseInt(m[0]) : null;
      }
      case 'gender':
        if (/\b(female|woman|girl|महिला|श्रीमती)\b/.test(t)) return 'female';
        if (/\b(male|mail|man|boy|पुरुष|श्री)\b/.test(t)) return 'male';
        if (/\bother\b/.test(t)) return 'other';
        return null;
      case 'phone': {
        // Convert spoken digit words to numerals before stripping non-digits
        const WORD_DIGITS: Record<string, string> = {
          zero:'0', one:'1', two:'2', three:'3', four:'4',
          five:'5', six:'6', seven:'7', eight:'8', nine:'9',
          shunya:'0', ek:'1', do:'2', teen:'3', char:'4',
          paanch:'5', chhe:'6', saat:'7', aath:'8', nau:'9',
        };
        const normalized = transcript.toLowerCase()
          .replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|shunya|ek|do|teen|char|paanch|chhe|saat|aath|nau)\b/g,
                   m => WORD_DIGITS[m]);
        const digits = normalized.replace(/\D/g, '');
        return digits.length >= 10 ? digits.slice(-10) : null;
      }
      case 'chiefComplaint':
        return transcript.trim() || null;
      default:
        return transcript.trim() || null;
    }
  }
}
