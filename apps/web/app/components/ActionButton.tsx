'use client';

import * as React from 'react';
import { Button, type buttonVariants } from '@app/components/ui/button';
import { cn } from '@app/lib/utils';
import type { VariantProps } from 'class-variance-authority';

const colorVariants = {
  success:
    'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600/20',
  warning:
    'bg-orange-500 text-white hover:bg-orange-600 focus-visible:ring-orange-500/20',
  muted:
    'bg-gray-600 text-white hover:bg-gray-700 focus-visible:ring-gray-600/20',
} as const;

export interface ActionButtonProps
  extends React.ComponentProps<'button'>,
    Omit<VariantProps<typeof buttonVariants>, 'variant'> {
  colorVariant?: keyof typeof colorVariants;
  asChild?: boolean;
}

/**
 * ActionButton - Wrapper around shadcn Button with semantic color variants
 *
 * Use this component for semantic actions (approve, decline, archive) rather than
 * modifying the original Button component. This preserves future shadcn updates.
 *
 * Location: apps/web/app/components/ActionButton.tsx
 * Note: Custom components go in /components, shadcn UI components go in /components/ui
 *
 * @example
 * // Success action (approve)
 * <ActionButton colorVariant="success" onClick={handleApprove}>
 *   Approve
 * </ActionButton>
 *
 * // Warning action
 * <ActionButton colorVariant="warning" onClick={handleWarn}>
 *   Warning
 * </ActionButton>
 *
 * // Muted action (archive)
 * <ActionButton colorVariant="muted" onClick={handleArchive}>
 *   Archive
 * </ActionButton>
 */
export function ActionButton({
  colorVariant,
  className,
  size,
  asChild,
  ...props
}: ActionButtonProps) {
  return (
    <Button
      className={cn(colorVariant && colorVariants[colorVariant], className)}
      size={size}
      asChild={asChild}
      {...props}
    />
  );
}
