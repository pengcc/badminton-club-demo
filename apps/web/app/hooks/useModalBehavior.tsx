import { useEffect, useCallback } from 'react';

interface UseModalBehaviorOptions {
  /** When true, enables ESC + backdrop close and disables body scroll */
  isOpen: boolean;
  /** Called when user confirms closing */
  onClose: () => void;
  /** Ask confirmation before closing if true */
  hasUnsavedChanges?: boolean;
  /** If false, clicking the backdrop won’t close */
  enableBackdropClose?: boolean;
}

/**
 * Shared modal behavior:
 * - Closes on ESC
 * - Locks body scroll
 * - (optional) confirms unsaved changes
 * - (optional) closes on backdrop click
 */
export function useModalBehavior({
  isOpen,
  onClose,
  hasUnsavedChanges = false,
  enableBackdropClose = true,
}: UseModalBehaviorOptions) {
  const handleCloseAttempt = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmed) return;
    }
    onClose();
  }, [onClose, hasUnsavedChanges]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleCloseAttempt();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleCloseAttempt]);

  // Return props to attach to the modal container for backdrop closing
  const modalProps = enableBackdropClose
    ? {
        onClick: (e: React.MouseEvent) => {
          if (e.target === e.currentTarget) {
            handleCloseAttempt();
          }
        },
      }
    : {};

  return { handleCloseAttempt, modalProps };
}
