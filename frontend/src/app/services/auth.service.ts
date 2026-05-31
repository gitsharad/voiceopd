import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { Doctor, Clinic, AuthResponse, ApiResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = `${environment.apiUrl}/auth`;

  private _doctor$ = new BehaviorSubject<Doctor | null>(null);
  private _clinic$ = new BehaviorSubject<Clinic | null>(null);

  doctor$ = this._doctor$.asObservable();
  clinic$ = this._clinic$.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    this.restoreSession();
  }

  get doctor(): Doctor | null { return this._doctor$.value; }
  get clinic(): Clinic | null { return this._clinic$.value; }
  get isLoggedIn(): boolean { return !!this.getAccessToken(); }
  get clinicId(): string { return this._clinic$.value?._id ?? ''; }

  register(payload: {
    name: string; email: string; password: string;
    phone: string; clinicName: string; specialization?: string;
  }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/register`, payload).pipe(
      tap(res => this.storeSession(res))
    );
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/login`, { email, password }).pipe(
      tap(res => this.storeSession(res))
    );
  }

  logout(): void {
    this.http.post(`${this.API}/logout`, {}).subscribe();
    this.clearSession();
    this.router.navigate(['/login']);
  }

  getMe(): Observable<ApiResponse<{ doctor: Doctor; clinic: Clinic }>> {
    return this.http.get<ApiResponse<{ doctor: Doctor; clinic: Clinic }>>(`${this.API}/me`).pipe(
      tap(res => {
        this._doctor$.next(res.data.doctor);
        this._clinic$.next(res.data.clinic);
      })
    );
  }

  refreshAccessToken(): Observable<ApiResponse<{ accessToken: string; refreshToken: string }>> {
    const refreshToken = localStorage.getItem('refreshToken');
    return this.http.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      `${this.API}/refresh`, { refreshToken }
    ).pipe(
      tap(res => {
        localStorage.setItem('accessToken', res.data.accessToken);
        localStorage.setItem('refreshToken', res.data.refreshToken);
      }),
      catchError(err => {
        this.clearSession();
        this.router.navigate(['/login']);
        return throwError(() => err);
      })
    );
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  private storeSession(res: AuthResponse): void {
    localStorage.setItem('accessToken', res.data.accessToken);
    localStorage.setItem('refreshToken', res.data.refreshToken);
    this._doctor$.next(res.data.doctor);
    this._clinic$.next(res.data.clinic);
  }

  private clearSession(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    this._doctor$.next(null);
    this._clinic$.next(null);
  }

  private restoreSession(): void {
    if (this.getAccessToken()) {
      this.getMe().subscribe({ error: () => this.clearSession() });
    }
  }
}
