'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@app/hooks/useAuth';
import { FormField } from '@app/components/FormField';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import { cn } from '@app/lib/utils';

export default function LoginForm() {
  const t = useTranslations('common');
  const tLogin = useTranslations('login');
  const { login, loginError } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleFieldChange = (field: 'email' | 'password', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFieldBlur = (field: string) => {
    setTouchedFields(prev => new Set([...prev, field]));
  };

  const getFieldError = (field: string) => {
    if (!touchedFields.has(field)) return undefined;

    if (field === 'email' && formData.email && !isValidEmail(formData.email)) {
      return [t('validation.email')];
    }
    if ((field === 'email' || field === 'password') && !formData[field]) {
      return [t('validation.required')];
    }
    return undefined;
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched for validation
    setTouchedFields(new Set(['email', 'password']));

    // Validate form
    const emailError = getFieldError('email');
    const passwordError = getFieldError('password');

    if (emailError || passwordError || !formData.email || !formData.password) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login({
        email: formData.email,
        password: formData.password
      });
      // Navigation handled by useAuth hook
    } catch (_err: any) {
      // Error displayed via loginError from useAuth
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {t('login')}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {loginError && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">
              {tLogin('error_invalid_credentials')}
            </p>
          </div>
        )}

        <FormField
          label={tLogin('email')}
          type="email"
          value={formData.email}
          onChange={(value) => handleFieldChange('email', value)}
          onBlur={() => handleFieldBlur('email')}
          required
          error={getFieldError('email')}
          name="email"
        />

        {/* Custom Password Field with Show/Hide Toggle */}
        <div className="space-y-2 form-field">
          <Label htmlFor="password" required>
            {tLogin('password')}
          </Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange('password', e.target.value)}
              onBlur={() => handleFieldBlur('password')}
              error={!!getFieldError('password')}
              className={cn(getFieldError('password') && 'border-destructive')}
              aria-invalid={!!getFieldError('password')}
              aria-describedby={getFieldError('password') ? 'password-error' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
              aria-label={showPassword ? tLogin('hide_password') : tLogin('show_password')}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          {getFieldError('password') && (
            <p className="text-sm text-destructive mt-1" id="password-error">
              {getFieldError('password')?.[0]}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? tLogin('logging_in') : t('login')}
        </button>
      </form>
    </div>
  );
}