import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Visit, ApiResponse, PaginatedResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class VisitService {
  private readonly API = `${environment.apiUrl}/visits`;
  constructor(private http: HttpClient) {}

  getVisits(params: { page?: number; limit?: number; patientId?: string; from?: string; to?: string } = {}): Observable<PaginatedResponse<Visit>> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => { if (v) p = p.set(k, String(v)); });
    return this.http.get<PaginatedResponse<Visit>>(this.API, { params: p });
  }

  getVisit(id: string): Observable<ApiResponse<Visit>> {
    return this.http.get<ApiResponse<Visit>>(`${this.API}/${id}`);
  }

  updateVisit(id: string, data: Partial<Visit>): Observable<ApiResponse<Visit>> {
    return this.http.put<ApiResponse<Visit>>(`${this.API}/${id}`, data);
  }
}
