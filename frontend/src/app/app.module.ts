import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// Interceptors
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { ErrorInterceptor } from './interceptors/error.interceptor';

// Shared components
import { SidebarComponent } from './components/shared/sidebar/sidebar.component';
import { NavbarComponent } from './components/shared/navbar/navbar.component';
import { VoiceModalComponent } from './components/shared/voice-modal/voice-modal.component';
import { PatientHistoryModalComponent } from './components/shared/patient-history-modal/patient-history-modal.component';
import { ToastContainerComponent } from './components/shared/toast-container/toast-container.component';

// Feature components
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { PatientsComponent } from './components/patients/patients.component';
import { PatientDetailComponent } from './components/patients/patient-detail/patient-detail.component';
import { TokensComponent } from './components/tokens/tokens.component';
import { PrescriptionsComponent } from './components/prescriptions/prescriptions.component';
import { PrescriptionFormComponent } from './components/prescriptions/prescription-form/prescription-form.component';
import { PrescriptionDetailComponent } from './components/prescriptions/prescription-detail/prescription-detail.component';
import { VisitsComponent } from './components/visits/visits.component';
import { ReportsComponent } from './components/reports/reports.component';
import { SettingsComponent } from './components/settings/settings.component';
import { AdminComponent } from './components/admin/admin.component';
import { LoginComponent } from './components/auth/login/login.component';
import { RegisterComponent } from './components/auth/register/register.component';
import { ForgotPasswordComponent } from './components/auth/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/auth/reset-password/reset-password.component';
import { LayoutComponent } from './components/shared/layout/layout.component';

@NgModule({
  declarations: [
    AppComponent,
    SidebarComponent,
    NavbarComponent,
    VoiceModalComponent,
    PatientHistoryModalComponent,
    ToastContainerComponent,
    LayoutComponent,
    DashboardComponent,
    PatientsComponent,
    PatientDetailComponent,
    TokensComponent,
    PrescriptionsComponent,
    PrescriptionFormComponent,
    PrescriptionDetailComponent,
    VisitsComponent,
    ReportsComponent,
    SettingsComponent,
    LoginComponent,
    RegisterComponent,
    ForgotPasswordComponent,
    ResetPasswordComponent,
    AdminComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    AppRoutingModule,
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
