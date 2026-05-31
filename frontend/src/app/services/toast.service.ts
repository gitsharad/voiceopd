import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts$ = new BehaviorSubject<Toast[]>([]);
  toasts$ = this._toasts$.asObservable();

  private show(message: string, type: Toast['type'], duration = 3000): void {
    const id = Date.now().toString();
    const toast: Toast = { id, message, type, duration };
    this._toasts$.next([...this._toasts$.value, toast]);
    setTimeout(() => this.dismiss(id), duration);
  }

  success(message: string) { this.show(message, 'success'); }
  error(message: string) { this.show(message, 'error', 5000); }
  warning(message: string) { this.show(message, 'warning', 4000); }
  info(message: string) { this.show(message, 'info'); }

  dismiss(id: string): void {
    this._toasts$.next(this._toasts$.value.filter(t => t.id !== id));
  }
}
