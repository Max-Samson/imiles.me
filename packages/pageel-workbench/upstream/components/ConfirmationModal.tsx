
import React from 'react';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel?: string;
    isProcessing: boolean;
    variant?: 'danger' | 'warning';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel,
    cancelLabel = 'Cancel',
    isProcessing,
    variant = 'danger'
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
            <div className="bg-notion-bg text-notion-text rounded-xl shadow-2xl border border-notion-border w-full max-w-sm overflow-hidden transform transition-all animate-fade-in">
                <div className="p-5">
                    <div className="flex items-start">
                        <div className={`flex-shrink-0 mr-3 mt-0.5`}>
                            <ExclamationTriangleIcon className={`h-5 w-5 ${variant === 'danger' ? 'text-red-500' : 'text-amber-500'}`} />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-notion-text leading-5">{title}</h3>
                            <div className="mt-1">
                                <p className="text-xs text-notion-muted leading-relaxed">{description}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-notion-sidebar/40 px-4 py-3 flex flex-row-reverse gap-2 border-t border-notion-border">
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className={`inline-flex justify-center items-center rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-white shadow-2xs transition-colors disabled:opacity-50 cursor-pointer ${
                            variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
                        }`}
                    >
                        {isProcessing && <SpinnerIcon className="w-3 h-3 mr-1.5 animate-spin" />}
                        {confirmLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isProcessing}
                        className="inline-flex justify-center items-center rounded-lg border border-notion-border bg-notion-sidebar/60 px-3 py-1.5 text-xs font-medium text-notion-text shadow-2xs hover:bg-notion-hover transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        {cancelLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
