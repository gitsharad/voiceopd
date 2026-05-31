import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Patient, CreatePatientDto, ApiResponse, PaginatedResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class PatientService {
  private readonly API = `${environment.apiUrl}/patients`;

  constructor(private http: HttpClient) {}

  getPatients(params: {
    search?: string; page?: number; limit?: number; sortBy?: string; order?: string;
  } = {}): Observable<PaginatedResponse<Patient>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) httpParams = httpParams.set(k, String(v)); });
    return this.http.get<PaginatedResponse<Patient>>(this.API, { params: httpParams });
  }

  getPatient(id: string): Observable<ApiResponse<Patient>> {
    return this.http.get<ApiResponse<Patient>>(`${this.API}/${id}`);
  }

  createPatient(dto: CreatePatientDto): Observable<ApiResponse<{ patient: Patient; token: any }>> {
    return this.http.post<ApiResponse<{ patient: Patient; token: any }>>(this.API, dto);
  }

  updatePatient(id: string, dto: Partial<Patient>): Observable<ApiResponse<Patient>> {
    return this.http.put<ApiResponse<Patient>>(`${this.API}/${id}`, dto);
  }

  deletePatient(id: string): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.API}/${id}`);
  }

  getPatientHistory(id: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API}/${id}/history`);
  }
}
