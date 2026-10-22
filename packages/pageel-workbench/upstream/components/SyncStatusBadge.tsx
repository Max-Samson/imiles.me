
import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface SyncStatusBadgeProps {
    isSynced: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ isSynced }) => {
    const { t } = useI18n();

    if (isSynced) {
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                <CheckCircleIcon className="w-4 h-4 mr-1.5" />
                仅内存编辑
            </span>
        );
    }

    return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200 animate-pulse">
            <SpinnerIcon className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            正在读取
        </span>
    );
};
