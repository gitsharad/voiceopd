import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { PrescriptionService } from '../../../services/prescription.service';
import { ToastService } from '../../../services/toast.service';
import { AiService } from '../../../services/ai.service';
import { Prescription } from '../../../models';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-prescription-detail',
  templateUrl: './prescription-detail.component.html',
  styleUrls: ['./prescription-detail.component.scss'],
})
export class PrescriptionDetailComponent implements OnInit {
  rx: Prescription | null = null;
  loading = false;

  // Share modal
  showShare     = false;
  msgText       = '';
  copied        = false;
  generatingPdf = false;

  // Edit mode
  editMode    = false;
  saving      = false;
  editForm!:  FormGroup;

  // Delete
  confirmDelete = false;
  deleting      = false;

  // Marathi translations of advice
  marathiAdvices: string[] = [];
  marathiLoading  = false;

  constructor(
    private route:     ActivatedRoute,
    private router:    Router,
    private fb:        FormBuilder,
    private rxService: PrescriptionService,
    private toast:     ToastService,
    private aiService: AiService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loading = true;
    this.rxService.getPrescription(id).subscribe({
      next: res => {
        this.rx = res.data;
        this.loading = false;
        this.fetchMarathiAdvice();
      },
      error: ()  => { this.loading = false; this.router.navigate(['/prescriptions']); },
    });
  }

  fetchMarathiAdvice(): void {
    const advices = (this.rx as any)?.advices;
    if (!advices?.length) return;
    this.marathiLoading = true;
    this.aiService.translateAdvice(advices).subscribe({
      next: res => { this.marathiAdvices = res.data || []; this.marathiLoading = false; },
      error: ()  => { this.marathiAdvices = []; this.marathiLoading = false; },
    });
  }

  // ── Edit mode ────────────────────────────────────────────────────
  startEdit(): void {
    const rx = this.rx as any;
    this.editForm = this.fb.group({
      diagnosis:   [rx.diagnosis || ''],
      advices:     [(rx.advices || []).join('\n')],
      followUpDate:[rx.followUpDate ? new Date(rx.followUpDate).toISOString().slice(0,10) : ''],
      medicines: this.fb.array(
        (rx.medicines || []).map((m: any) => this.medGroup(m))
      ),
    });
    this.editMode = true;
  }

  cancelEdit(): void { this.editMode = false; }

  get medsArray(): FormArray {
    return this.editForm.get('medicines') as FormArray;
  }

  medGroup(m: any = {}): FormGroup {
    return this.fb.group({
      name:         [m.name || '',     Validators.required],
      dosage:       [m.dosage || '',   Validators.required],
      frequency:    [m.frequency || '', Validators.required],
      duration:     [m.duration || '',  Validators.required],
      instructions: [m.instructions || ''],
    });
  }

  addMed(): void { this.medsArray.push(this.medGroup()); }

  removeMed(i: number): void {
    if (this.medsArray.length > 1) this.medsArray.removeAt(i);
  }

  saveEdit(): void {
    if (this.editForm.invalid) { this.editForm.markAllAsTouched(); return; }
    this.saving = true;
    const v = this.editForm.value;
    const dto = {
      diagnosis:   v.diagnosis.trim(),
      medicines:   v.medicines,
      advices:     v.advices ? v.advices.split('\n').map((s: string) => s.trim()).filter(Boolean) : [],
      followUpDate: v.followUpDate || null,
    };
    this.rxService.updatePrescription((this.rx as any)._id, dto).subscribe({
      next: res => {
        this.rx    = res.data;
        this.editMode = false;
        this.saving   = false;
        this.toast.success('Prescription updated');
        this.fetchMarathiAdvice();
      },
      error: () => { this.saving = false; },
    });
  }

  // ── Delete ────────────────────────────────────────────────────────
  deleteRx(): void {
    this.deleting = true;
    this.rxService.deletePrescription((this.rx as any)._id).subscribe({
      next: () => {
        this.toast.success('Prescription deleted');
        this.router.navigate(['/prescriptions']);
      },
      error: () => { this.deleting = false; },
    });
  }

  // ── PDF ──────────────────────────────────────────────────────────
  private async buildPdfBlob(): Promise<Blob> {
    // Wait for fonts (including Noto Sans Devanagari) to fully load
    await (document as any).fonts.ready;

    const slip = document.querySelector('.rx-slip') as HTMLElement;
    const canvas = await html2canvas(slip, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf     = new jsPDF('p', 'mm', 'a4');
    const pageW   = pdf.internal.pageSize.getWidth();
    const pageH   = pdf.internal.pageSize.getHeight();
    const imgH    = (canvas.height * pageW) / canvas.width;
    let   yPos    = 0;

    // Multi-page support: if prescription is taller than one page, slice it
    while (yPos < imgH) {
      if (yPos > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, -yPos, pageW, imgH);
      yPos += pageH;
    }
    return pdf.output('blob');
  }

  // ── Share modal ──────────────────────────────────────────────────
  openShare(): void {
    this.msgText   = this.buildMessage();
    this.copied    = false;
    this.showShare = true;
  }

  closeShare(): void { this.showShare = false; }

  /** Generate PDF and send via WhatsApp.
   *  Mobile: opens native share sheet → user picks WhatsApp → PDF is already attached.
   *  Desktop: downloads PDF + opens WhatsApp web with text so user can attach manually. */
  async sendWhatsApp(): Promise<void> {
    if (this.generatingPdf) return;
    this.generatingPdf = true;
    try {
      // Wait for Marathi translations to finish loading before capturing PDF
      if (this.marathiLoading) {
        await new Promise<void>(resolve => {
          const check = setInterval(() => {
            if (!this.marathiLoading) { clearInterval(check); resolve(); }
          }, 100);
          setTimeout(() => { clearInterval(check); resolve(); }, 3000); // 3s max wait
        });
      }
      const blob     = await this.buildPdfBlob();
      const fileName = `Rx-${(this.rx as any).prescriptionNumber}.pdf`;
      const file     = new File([blob], fileName, { type: 'application/pdf' });
      const nav      = navigator as any;

      if (nav.canShare?.({ files: [file] })) {
        // Mobile: native share sheet — user taps WhatsApp and the PDF is attached
        await nav.share({
          title: `Prescription – ${this.patient?.name || ''}`,
          files: [file],
        });
      } else {
        // Desktop: download PDF, then open WhatsApp web
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
        const phone = (this.patient?.phone || '').replace(/\D/g, '');
        const waUrl = phone
          ? `https://wa.me/91${phone}?text=${encodeURIComponent(this.msgText)}`
          : `https://wa.me/?text=${encodeURIComponent(this.msgText)}`;
        window.open(waUrl, '_blank');
        this.toast.success('PDF downloaded — attach it in the WhatsApp chat that opened');
      }

      // Mark as sent in backend
      this.rxService.sendWhatsApp((this.rx as any)._id).subscribe({
        next: () => { (this.rx as any).whatsappSent = true; this.showShare = false; },
        error: () => {},
      });
    } catch (err: any) {
      if (err?.name !== 'AbortError') this.toast.error('Could not share PDF');
    } finally {
      this.generatingPdf = false;
    }
  }

  sendSMS(): void {
    const phone = (this.patient?.phone || '').replace(/\D/g, '');
    const url   = phone
      ? `sms:+91${phone}?body=${encodeURIComponent(this.msgText)}`
      : `sms:?body=${encodeURIComponent(this.msgText)}`;
    window.open(url, '_blank');
  }

  copyMessage(): void {
    navigator.clipboard.writeText(this.msgText).then(() => {
      this.copied = true;
      this.toast.success('Message copied to clipboard');
      setTimeout(() => { this.copied = false; }, 2500);
    });
  }

  get canNativeShare(): boolean { return !!(navigator as any).share; }

  nativeShare(): void {
    (navigator as any).share({
      title: `Prescription – ${this.patient?.name || ''}`,
      text:  this.msgText,
    }).catch(() => {});
  }

  async print(): Promise<void> {
    // Wait for Marathi translations before printing
    if (this.marathiLoading) {
      await new Promise<void>(resolve => {
        const check = setInterval(() => {
          if (!this.marathiLoading) { clearInterval(check); resolve(); }
        }, 100);
        setTimeout(() => { clearInterval(check); resolve(); }, 3000);
      });
    }
    await (document as any).fonts.ready;
    window.print();
  }

  // ── Getters ──────────────────────────────────────────────────────
  get rxAny():   any { return this.rx; }
  get patient(): any { return (this.rx as any)?.patientId; }
  get doctor():  any { return (this.rx as any)?.doctorId;  }
  get visit():   any { return (this.rx as any)?.visitId;   }

  clinicAddress(): string {
    const a = this.doctor?.clinicId?.address;
    if (!a) return '';
    return [a.line1, a.city, a.state, a.pincode].filter(Boolean).join(', ');
  }

  private buildMessage(): string {
    const rx = this.rx as any;
    if (!rx) return '';
    const meds = (rx.medicines || []).map((m: any, i: number) =>
      `${i + 1}. ${m.name} ${m.dosage} — ${m.frequency} × ${m.duration}` +
      (m.instructions ? ` (${m.instructions})` : '')
    ).join('\n');
    return (
      `🏥 *VoiceOPD Prescription*\n\n` +
      `Patient: *${this.patient?.name || ''}*\n` +
      `Rx No: ${rx.prescriptionNumber || ''}\n` +
      `Date: ${new Date(rx.createdAt).toDateString()}\n` +
      `Diagnosis: ${rx.diagnosis || 'As discussed'}\n\n` +
      `*Medicines:*\n${meds}\n\n` +
      (rx.advices?.length ? `*Advice:*\n${rx.advices.join('\n')}\n\n` : '') +
      (rx.followUpDate ? `*Follow-up:* ${new Date(rx.followUpDate).toDateString()}\n\n` : '') +
      `💊 Take medicines as prescribed. Get well soon!`
    );
  }
}
