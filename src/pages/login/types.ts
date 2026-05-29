/**
 * SPARKOS FITNESS — Login Page shared types
 */

export type FormStep = 'choice' | 'credentials' | 'new-user-form' | 'forgot-password' | 'success';

export interface SignInFormData {
  email: string;
  password: string;
  showPassword: boolean;
}

export interface SignUpFormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  showConfirmPassword: boolean;
}

export interface ForgotPasswordFormData {
  email: string;
}

export interface ValidationErrors {
  email?: string;
  password?: string;
  fullName?: string;
  confirmPassword?: string;
  general?: string;
}
