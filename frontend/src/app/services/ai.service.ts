import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AiMedicine {
  name: string; dosage: string; frequency: string;
  duration: string; instructions: string; routeOfAdmin: string;
}

export interface AiRecommendation {
  medicines: AiMedicine[];
  advice: string[];
  clinicalNotes: string;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly API = `${environment.apiUrl}/ai`;
  constructor(private http: HttpClient) {}

  recommend(diagnosis: string, symptoms: string): Observable<{ success: boolean; data: AiRecommendation }> {
    return this.http.post<{ success: boolean; data: AiRecommendation }>(`${this.API}/recommend`, { diagnosis, symptoms });
  }

  translateAdvice(advices: string[]): Observable<{ success: boolean; data: string[] }> {
    return this.http.post<{ success: boolean; data: string[] }>(`${this.API}/translate-advice`, { advices });
  }
}
