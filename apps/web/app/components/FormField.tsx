'use client';

import React from 'react';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import { cn } from '@app/lib/utils';

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string[];
  className?: string;
  placeholder?: string;
  name?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  required = false,
  disabled = false,
  error,
  className,
  placeholder,
  name,
}) => {
  const hasError = error && error.length > 0;
  const fieldId = React.useId();
  const fieldName = name || fieldId;

  return (
    <div className={cn('space-y-2 form-field', className)}>
      <Label htmlFor={fieldId} required={required}>
        {label}
      </Label>
      <Input
        id={fieldId}
        name={fieldName}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        error={hasError}
        placeholder={placeholder}
        className={cn(hasError && 'border-destructive')}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${fieldId}-error` : undefined}
      />
      {hasError && (
        <p className="text-sm text-destructive mt-1" id={`${fieldId}-error`}>
          {error[0]}
        </p>
      )}
    </div>
  );
};