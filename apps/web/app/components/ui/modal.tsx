'use client';

import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
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
 * <Modal isOpen={isOpen} onClose={handleClose}>
 *   <div className="bg-white rounded-lg p-6">
 *     Modal content here
 *   </div>
 * </Modal>
 * ```
 */
export function Modal({ isOpen, onClose, children, className = '' }: ModalProps) {
  // Lock body scroll when modal opens (mobile-first approach)
  useEffect(() => {
    if (isOpen) {
      // Prevent background scrolling on mobile and desktop
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';

      // Add padding to prevent layout shift from scrollbar disappearing
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }

      return () => {
        // Restore body scroll
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      };
    }
  }, [isOpen]);

  // ESC key to close
  useEffect(() => {
    if (!isOpen || !onClose) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${className}`}
      onClick={(e) => {
        // Close on backdrop click (but not on modal content click)
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      {children}
    </div>
  );
}
