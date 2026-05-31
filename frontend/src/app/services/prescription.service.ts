// prescription.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Prescription, CreatePrescriptionDto, ApiResponse, PaginatedResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class PrescriptionService {
  private readonly API = `${environment.apiUrl}/prescriptions`;
  constructor(private http: HttpClient) {}

  getPrescriptions(params: { page?: number; limit?: number; patientId?: string; date?: string } = {}): Observable<PaginatedResponse<Prescription>> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => { if (v) p = p.set(k, String(v)); });
    return this.http.get<PaginatedResponse<Prescription>>(this.API, { params: p });
  }

  getPrescription(id: string): Observable<ApiResponse<Prescription>> {
    return this.http.get<ApiResponse<Prescription>>(`${this.API}/${id}`);
  }

  createPrescription(dto: CreatePrescriptionDto): Observable<ApiResponse<Prescription>> {
    return this.http.post<ApiResponse<Prescription>>(this.API, dto);
  }

  updatePrescription(id: string, dto: any): Observable<ApiResponse<Prescription>> {
    return this.http.put<ApiResponse<Prescription>>(`${this.API}/${id}`, dto);
  }

  deletePrescription(id: string): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.API}/${id}`);
  }

  sendWhatsApp(id: string): Observable<ApiResponse<{ message: string }>> {
    return this.http.post<ApiResponse<{ message: string }>>(`${this.API}/${id}/whatsapp`, {});
  }
}
