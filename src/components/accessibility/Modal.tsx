/**
 * Accessible Modal Component
 * Provides focus trapping, keyboard navigation, and screen reader support
 */

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap, useEscapeKey, useFocusRestore } from '../../hooks/useAccessibility';
import { focusVisible } from '../../utils/accessibility';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  actions?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  showCloseButton = true,
  actions
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const { saveFocus, restoreFocus } = useFocusRestore();
  
  // Trap focus when modal is open
  useFocusTrap(modalRef, isOpen);
  
  // Close on escape key
  useEscapeKey(onClose, isOpen);
  
  // Save and restore focus
  useEffect(() => {
    if (isOpen) {
      saveFocus();
    } else {
      restoreFocus();
    }
  }, [isOpen, saveFocus, restoreFocus]);
  
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };
  
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-40"
        aria-hidden="true"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
          <div
            ref={modalRef}
            className={`relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full ${sizeClasses[size]}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby={description ? 'modal-description' : undefined}
          >
            {/* Header */}
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 
                    id="modal-title" 
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    {title}
                  </h3>
                  {description && (
                    <p 
                      id="modal-description" 
                      className="mt-2 text-sm text-gray-500"
                    >
                      {description}
                    </p>
                  )}
                </div>
                {showCloseButton && (
                  <button
                    type="button"
                    className={`ml-3 inline-flex text-gray-400 hover:text-gray-500 ${focusVisible}`}
                    onClick={onClose}
                    aria-label="Close modal"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
              </div>
              
              {/* Content */}
              <div className="mt-4">
                {children}
              </div>
            </div>
            
            {/* Actions */}
            {actions && (
              <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                {actions}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Modal;