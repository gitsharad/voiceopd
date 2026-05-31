import { Component, OnInit } from '@angular/core';
import { PrescriptionService } from '../../services/prescription.service';
import { ToastService } from '../../services/toast.service';
import { Prescription } from '../../models';

@Component({
  selector: 'app-prescriptions',
  templateUrl: './prescriptions.component.html',
  styleUrls: ['./prescriptions.component.scss'],
})
export class PrescriptionsComponent implements OnInit {
  prescriptions: Prescription[] = [];
  total = 0; page = 1; pages = 1; loading = false;
  sendingId: string | null = null;

  // Share modal state
  shareRx:   any    = null;   // prescription being shared
  msgText:   string = '';
  copied     = false;

  // Delete
  deleteConfirmId: string | null = null;
  deletingId:      string | null = null;

  constructor(
    private rxService: PrescriptionService,
    private toast:     ToastService,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.rxService.getPrescriptions({ page: this.page, limit: 15 }).subscribe(res => {
      this.prescriptions = res.data;
      this.total = res.pagination.total;
      this.pages = res.pagination.pages;
      this.loading = false;
    });
  }

  // ── Open share modal ──────────────────────────────────────────────
  openShare(rx: any): void {
    this.shareRx = rx;
    this.msgText = this.buildMessage(rx);
    this.copied  = false;
  }

  closeShare(): void { this.shareRx = null; }

  // ── WhatsApp ──────────────────────────────────────────────────────
  sendWhatsApp(): void {
    const rx    = this.shareRx;
    const phone = (rx?.patientId?.phone || '').replace(/\D/g, '');
    const url   = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(this.msgText)}`
      : `https://wa.me/?text=${encodeURIComponent(this.msgText)}`;

    window.open(url, '_blank');

    // mark sent in backend
    this.sendingId = rx._id;
    this.rxService.sendWhatsApp(rx._id).subscribe({
      next: () => {
        rx.whatsappSent = true;
        this.sendingId  = null;
        this.closeShare();
      },
      error: () => { this.sendingId = null; },
    });
  }

  // ── SMS ───────────────────────────────────────────────────────────
  sendSMS(): void {
    const phone = (this.shareRx?.patientId?.phone || '').replace(/\D/g, '');
    const url   = phone
      ? `sms:+91${phone}?body=${encodeURIComponent(this.msgText)}`
      : `sms:?body=${encodeURIComponent(this.msgText)}`;
    window.open(url, '_blank');
  }

  // ── Copy ──────────────────────────────────────────────────────────
  copyMessage(): void {
    navigator.clipboard.writeText(this.msgText).then(() => {
      this.copied = true;
      this.toast.success('Message copied to clipboard');
      setTimeout(() => { this.copied = false; }, 2500);
    });
  }

  // ── Native share ──────────────────────────────────────────────────
  get canNativeShare(): boolean { return !!(navigator as any).share; }

  nativeShare(): void {
    (navigator as any).share({
      title: `Prescription – ${this.shareRx?.patientId?.name || ''}`,
      text:  this.msgText,
    }).catch(() => {});
  }

  // ── Delete ────────────────────────────────────────────────────────
  confirmDeleteRx(id: string): void { this.deleteConfirmId = id; }
  cancelDeleteRx(): void  { this.deleteConfirmId = null; }

  deleteRx(id: string): void {
    this.deletingId = id;
    this.rxService.deletePrescription(id).subscribe({
      next: () => {
        this.prescriptions = this.prescriptions.filter(rx => (rx as any)._id !== id);
        this.total--;
        this.deleteConfirmId = null;
        this.deletingId      = null;
        this.toast.success('Prescription deleted');
      },
      error: () => { this.deletingId = null; },
    });
  }

  goPage(p: number): void {
    if (p >= 1 && p <= this.pages) { this.page = p; this.load(); }
  }

  // ── Build message ─────────────────────────────────────────────────
  private buildMessage(rx: any): string {
    const meds = (rx.medicines || []).map((m: any, i: number) =>
      `${i + 1}. ${m.name} ${m.dosage} — ${m.frequency} × ${m.duration}` +
      (m.instructions ? ` (${m.instructions})` : '')
    ).join('\n');

    return (
      `🏥 *VoiceOPD Prescription*\n\n` +
      `Patient: *${rx.patientId?.name || ''}*\n` +
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
