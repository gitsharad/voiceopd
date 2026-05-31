import { Component } from '@angular/core';
import { ToastService, Toast } from '../../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  template: `
    <div class="toast-container">
      <div
        class="toast-item"
        *ngFor="let t of toast.toasts$ | async"
        [ngClass]="t.type"
        (click)="toast.dismiss(t.id)"
      >
        <span class="toast-icon">
          <ng-container [ngSwitch]="t.type">
            <span *ngSwitchCase="'success'">✓</span>
            <span *ngSwitchCase="'error'">✕</span>
            <span *ngSwitchCase="'warning'">⚠</span>
            <span *ngSwitchDefault>ℹ</span>
          </ng-container>
        </span>
        <span>{{ t.message }}</span>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed; bottom: 24px; right: 24px;
      z-index: 9999; display: flex; flex-direction: column;
      gap: 8px; pointer-events: none;
    }
    .toast-item {
      background: #0B1437; color: #fff; padding: 12px 16px;
      border-radius: 12px; font-size: 13px; font-weight: 500;
      display: flex; align-items: center; gap: 10px;
      box-shadow: 0 8px 32px rgba(0,0,0,.2);
      animation: toastIn .3s cubic-bezier(.34,1.56,.64,1);
      pointer-events: all; max-width: 340px; cursor: pointer;
      &.success .toast-icon { color: #00C896; }
      &.error { background: #450a0a; border: 1px solid #7f1d1d; }
      &.warning { background: #451a03; border: 1px solid #78350f; }
      &.info .toast-icon { color: #3B82F6; }
    }
    .toast-icon { font-size: 15px; flex-shrink: 0; }
    @keyframes toastIn {
      from { transform: translateX(60px); opacity: 0; }
      to { transform: none; opacity: 1; }
    }
  `]
})
export class ToastContainerComponent {
  constructor(public toast: ToastService) {}
}
