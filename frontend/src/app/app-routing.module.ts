import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from './guards/auth.guard';
import { GuestGuard } from './guards/guest.guard';
import { AdminGuard } from './guards/admin.guard';

import { LayoutComponent } from './components/shared/layout/layout.component';
import { LoginComponent } from './components/auth/login/login.component';
import { RegisterComponent } from './components/auth/register/register.component';
import { ForgotPasswordComponent } from './components/auth/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/auth/reset-password/reset-password.component';
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

const routes: Routes = [
  { path: 'login',            component: LoginComponent,         canActivate: [GuestGuard] },
  { path: 'register',         component: RegisterComponent },
  { path: 'forgot-password',  component: ForgotPasswordComponent, canActivate: [GuestGuard] },
  { path: 'reset-password/:token', component: ResetPasswordComponent, canActivate: [GuestGuard] },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent, title: 'Dashboard – VoiceOPD' },
      { path: 'patients', component: PatientsComponent, title: 'Patients – VoiceOPD' },
      { path: 'patients/:id', component: PatientDetailComponent, title: 'Patient Detail – VoiceOPD' },
      { path: 'tokens', component: TokensComponent, title: 'Token Queue – VoiceOPD' },
      { path: 'prescriptions', component: PrescriptionsComponent, title: 'Prescriptions – VoiceOPD' },
      { path: 'prescriptions/new', component: PrescriptionFormComponent, title: 'New Prescription – VoiceOPD' },
      { path: 'prescriptions/:id', component: PrescriptionDetailComponent, title: 'Prescription – VoiceOPD' },
      { path: 'prescriptions/:id/edit', component: PrescriptionFormComponent, title: 'Edit Prescription – VoiceOPD' },
      { path: 'visits', component: VisitsComponent, title: 'Visits – VoiceOPD' },
      { path: 'reports', component: ReportsComponent, title: 'Reports – VoiceOPD' },
      { path: 'settings', component: SettingsComponent, title: 'Settings – VoiceOPD' },
      { path: 'admin',    component: AdminComponent,    title: 'Admin Panel – VoiceOPD', canActivate: [AdminGuard] },
    ],
  },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
