'use client';

import React from 'react';
import { Input } from '@app/components/ui/input';
import { FormLabel } from '@app/components/FormLabel';
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
  max?: string;
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
  max,
}) => {
  const hasError = error && error.length > 0;
  const fieldId = React.useId();
  const fieldName = name || fieldId;

  return (
    <div className={cn('space-y-2 form-field', className)}>
      <FormLabel htmlFor={fieldId} required={required}>
        {label}
      </FormLabel>
      <Input
        id={fieldId}
        name={fieldName}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        max={max}
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
