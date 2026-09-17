'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@app/components/ui/alert-dialog';
import { Button } from '@app/components/ui/button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
  pendingText: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
}

/**
 * Branded Confirm Dialog
 *
 * Replaces window.confirm() with a consistent, accessible dialog.
 *
 * @example
 * ```tsx
 * const [showConfirm, setShowConfirm] = useState(false);
 *
 * <ConfirmDialog
 *   open={showConfirm}
 *   onOpenChange={setShowConfirm}
 *   title="Delete User"
 *   description="Are you sure you want to delete this user? This action cannot be undone."
 *   confirmText="Delete"
 *   cancelText="Cancel"
 *   pendingText="Deleting..."
 *   variant="destructive"
 *   onConfirm={async () => {
 *     await deleteUser(userId);
 *     setShowConfirm(false);
 *   }}
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText,
  pendingText,
  variant = 'default',
  onConfirm,
}: ConfirmDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Error handling is done in the parent component
      console.error('Confirmed UI action failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isLoading) onOpenChange(nextOpen);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {cancelText}
          </AlertDialogCancel>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            variant={variant}
          >
            {isLoading ? pendingText : confirmText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook for managing confirm dialog state
 *
 * @example
 * ```tsx
 * const { showConfirm, confirmProps, confirm: confirmDialog } = useConfirmDialog({
 *   confirmText: t('confirm'),
 *   cancelText: t('cancel'),
 *   pendingText: t('processing'),
 * });
 *
 * <button onClick={() => confirmDialog({
 *   title: 'Delete User',
 *   description: 'Are you sure?',
 *   onConfirm: () => deleteUser(id)
 * })}>
 *   Delete
 * </button>
 *
 * <ConfirmDialog {...confirmProps} />
 * ```
 */
type ConfirmDialogLabels = Pick<
  ConfirmDialogProps,
  'confirmText' | 'cancelText' | 'pendingText'
>;

type ConfirmDialogConfig = Omit<
  ConfirmDialogProps,
  'open' | 'onOpenChange' | keyof ConfirmDialogLabels
> &
  Partial<ConfirmDialogLabels>;

export function useConfirmDialog({
  confirmText,
  cancelText,
  pendingText,
}: ConfirmDialogLabels) {
  const [open, setOpen] = React.useState(false);
  const [config, setConfig] = React.useState<
    Omit<ConfirmDialogProps, 'open' | 'onOpenChange'>
  >({
    confirmText,
    cancelText,
    pendingText,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const confirm = React.useCallback(
    (newConfig: ConfirmDialogConfig) => {
      setConfig({
        confirmText,
        cancelText,
        pendingText,
        ...newConfig,
      });
      setOpen(true);
    },
    [cancelText, confirmText, pendingText]
  );

  const confirmProps: ConfirmDialogProps = {
    ...config,
    open,
    onOpenChange: setOpen,
  };

  return {
    showConfirm: open,
    confirmProps,
    confirm,
  };
}
