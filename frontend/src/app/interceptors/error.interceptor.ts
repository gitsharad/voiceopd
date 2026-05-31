import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToastService } from '../services/toast.service';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(private toast: ToastService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        const message = err.error?.message || err.message || 'An unexpected error occurred';
        if (err.status >= 500) {
          this.toast.error(`Server error: ${message}`);
        } else if (err.status === 403) {
          this.toast.error('You do not have permission to perform this action');
        } else if (err.status === 404) {
          // silently pass 404s — components handle them
        } else if (err.status !== 401) {
          this.toast.error(message);
        }
        return throwError(() => err);
      })
    );
  }
}
