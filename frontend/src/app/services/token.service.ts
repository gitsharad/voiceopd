import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { OpdToken, TodayTokensResponse, ApiResponse } from '../models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly API = `${environment.apiUrl}/tokens`;
  private socket!: Socket;

  private _todayTokens$ = new BehaviorSubject<TodayTokensResponse | null>(null);
  todayTokens$ = this._todayTokens$.asObservable();

  constructor(private http: HttpClient, private auth: AuthService) {
    this.initSocket();
  }

  private initSocket(): void {
    this.socket = io(environment.socketUrl, { withCredentials: true });
    this.socket.on('connect', () => {
      const clinicId = this.auth.clinicId;
      if (clinicId) this.socket.emit('join-clinic', clinicId);
    });

    // Real-time updates
    this.socket.on('token:new', () => this.loadTodayTokens().subscribe());
    this.socket.on('token:called', () => this.loadTodayTokens().subscribe());
    this.socket.on('token:next', () => this.loadTodayTokens().subscribe());
    this.socket.on('token:skipped', () => this.loadTodayTokens().subscribe());
    this.socket.on('token:completed', () => this.loadTodayTokens().subscribe());
  }

  loadTodayTokens(): Observable<ApiResponse<TodayTokensResponse>> {
    return this.http.get<ApiResponse<TodayTokensResponse>>(`${this.API}/today`).pipe(
      tap(res => this._todayTokens$.next(res.data))
    );
  }

  addToQueue(patientId: string, chiefComplaint = ''): Observable<ApiResponse<OpdToken>> {
    return this.http.post<ApiResponse<OpdToken>>(this.API, { patientId, chiefComplaint }).pipe(
      tap(() => this.loadTodayTokens().subscribe())
    );
  }

  callNext(): Observable<ApiResponse<OpdToken>> {
    return this.http.post<ApiResponse<OpdToken>>(`${this.API}/next`, {}).pipe(
      tap(() => this.loadTodayTokens().subscribe())
    );
  }

  callToken(id: string): Observable<ApiResponse<OpdToken>> {
    return this.http.post<ApiResponse<OpdToken>>(`${this.API}/${id}/call`, {}).pipe(
      tap(() => this.loadTodayTokens().subscribe())
    );
  }

  skipToken(id: string): Observable<ApiResponse<OpdToken>> {
    return this.http.post<ApiResponse<OpdToken>>(`${this.API}/${id}/skip`, {}).pipe(
      tap(() => this.loadTodayTokens().subscribe())
    );
  }

  completeToken(id: string): Observable<ApiResponse<OpdToken>> {
    return this.http.post<ApiResponse<OpdToken>>(`${this.API}/${id}/complete`, {}).pipe(
      tap(() => this.loadTodayTokens().subscribe())
    );
  }
}
