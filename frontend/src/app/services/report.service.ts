import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DashboardStats, DailyData, ApiResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly API = `${environment.apiUrl}/reports`;
  constructor(private http: HttpClient) {}

  getDashboardStats(): Observable<ApiResponse<DashboardStats>> {
    return this.http.get<ApiResponse<DashboardStats>>(`${this.API}/dashboard`);
  }

  getWeeklyReport(): Observable<ApiResponse<DailyData[]>> {
    return this.http.get<ApiResponse<DailyData[]>>(`${this.API}/weekly`);
  }

  getMonthlyReport(year?: number, month?: number): Observable<ApiResponse<any[]>> {
    let url = `${this.API}/monthly`;
    const params: string[] = [];
    if (year) params.push(`year=${year}`);
    if (month) params.push(`month=${month}`);
    if (params.length) url += '?' + params.join('&');
    return this.http.get<ApiResponse<any[]>>(url);
  }

  getTopMedicines(limit = 10): Observable<ApiResponse<{ _id: string; count: number }[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.API}/top-medicines?limit=${limit}`);
  }

  getTopDiagnoses(limit = 10): Observable<ApiResponse<{ _id: string; count: number }[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.API}/top-diagnoses?limit=${limit}`);
  }
}
