'use client';

import React, { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from './input';
import { Badge } from './badge';
import { cn } from '@app/lib/utils';

interface EmailChipInputProps {
  id: string;
  emails: string[];
  onChange: (emails: string[]) => void;
  placeholder: string;
  invalidEmailMessage: string;
  duplicateEmailMessage: string;
  instructions: string;
  getRemoveEmailLabel: (email: string) => string;
  className?: string;
}

export function EmailChipInput({
  id,
  emails,
  onChange,
  placeholder,
  invalidEmailMessage,
  duplicateEmailMessage,
  instructions,
  getRemoveEmailLabel,
  className,
}: EmailChipInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const addEmail = (email: string) => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) return;

    if (!validateEmail(trimmedEmail)) {
      setError(invalidEmailMessage);
      return;
    }

    if (emails.includes(trimmedEmail)) {
      setError(duplicateEmailMessage);
      return;
    }

    onChange([...emails, trimmedEmail]);
    setInputValue('');
    setError('');
  };

  const removeEmail = (emailToRemove: string) => {
    onChange(emails.filter((email) => email !== emailToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmail(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && emails.length > 0) {
      // Remove last email on backspace if input is empty
      removeEmail(emails[emails.length - 1]);
    }
  };

  const handleBlur = () => {
    if (inputValue) {
      addEmail(inputValue);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div
        data-slot="email-chip-input-control"
        className={cn(
          'flex min-h-[42px] flex-wrap gap-2 rounded-md border border-input bg-background p-3 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring',
          error && 'border-destructive focus-within:ring-destructive'
        )}
      >
        {emails.map((email) => (
          <Badge
            key={email}
            variant="secondary"
            className="flex items-center gap-1 px-2 py-1"
          >
            {email}
            <button
              type="button"
              onClick={() => removeEmail(email)}
              aria-label={getRemoveEmailLabel(email)}
              className="ml-1 hover:bg-muted rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          id={id}
          type="email"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setError('');
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={emails.length === 0 ? placeholder : ''}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-instructions${error ? ` ${id}-error` : ''}`}
          className="h-auto min-w-[200px] flex-1 border-0 p-0 focus-visible:ring-0 aria-[invalid=true]:border-0 aria-[invalid=true]:focus-visible:ring-0"
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <p id={`${id}-instructions`} className="text-xs text-muted-foreground">
        {instructions}
      </p>
    </div>
  );
}
