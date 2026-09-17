'use client';

import * as React from 'react';
import { Label } from '@app/components/ui/label';
import { cn } from '@app/lib/utils';

type FormLabelProps = React.ComponentProps<typeof Label> & {
  required?: boolean;
  icon?: React.ReactNode;
};

export function FormLabel({
  children,
  required = false,
  icon,
  className,
  ...props
}: FormLabelProps) {
  return (
    <Label
      {...props}
      className={cn(
        'gap-1',
        required &&
          "after:content-['*'] after:text-destructive after:text-[0.85em]",
        className
      )}
    >
      {icon && <span className="flex items-center">{icon}</span>}
      <span>{children}</span>
    </Label>
  );
}
