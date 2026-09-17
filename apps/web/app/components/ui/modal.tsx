'use client';

import React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@app/components/ui/dialog';

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
  /** Locale-aware accessible name for the dialog. */
  ariaLabel: string;
  /** Controls focus handling when a caller temporarily swaps composed dialogs. */
  focusReturnMode?: 'restore' | 'preserve';
  /** Resolves a caller-owned focus target that may be remounted during close. */
  returnFocusTo?: () => HTMLElement | null;
}

/**
 * Global Modal wrapper component with body scroll lock
 *
 * Features:
 * - Locks body scroll when modal is open (mobile-first approach)
 * - Restores scroll when modal closes
 * - ESC key to close (if onClose provided)
 * - Click outside to close (if onClose provided)
 * - Mobile-responsive design
 *
 * Usage:
 * ```tsx
 * <Modal isOpen={isOpen} onClose={handleClose} ariaLabel="Localized task name">
 *   <div className="bg-white rounded-lg p-6">
 *     Modal content here
 *   </div>
 * </Modal>
 * ```
 */
export function Modal({
  isOpen,
  onClose,
  children,
  className = '',
  ariaLabel,
  focusReturnMode = 'restore',
  returnFocusTo,
}: ModalProps) {
  const returnFocusRef = React.useRef<HTMLElement | null>(null);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose?.();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={`max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-none justify-items-center overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-none ${className}`}
        onOpenAutoFocus={(event) => {
          if (returnFocusRef.current) {
            event.preventDefault();
          } else if (document.activeElement instanceof HTMLElement) {
            returnFocusRef.current = document.activeElement;
          }
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (focusReturnMode === 'restore') {
            (returnFocusTo?.() ?? returnFocusRef.current)?.focus();
            returnFocusRef.current = null;
          }
        }}
        onEscapeKeyDown={(event) => {
          if (!onClose) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (!onClose) event.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">{ariaLabel}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
