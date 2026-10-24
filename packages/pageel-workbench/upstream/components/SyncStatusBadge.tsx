
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
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircleIcon className="w-4 h-4 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                存储已就绪
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
