import React from 'react';
import type { ChatMessage } from '../types';

export const LegacyFallbackBadge = ({ message }: { message: ChatMessage }): React.ReactElement | null => {
    if (!message.floraGPTDebug?.fallbackUsed) return null;
    return React.createElement(
        'span',
        {
            className: 'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700'
        },
        'Legacy fallback'
    );
};

export const CompatibilityBadge = ({ message }: { message: ChatMessage }): React.ReactElement | null => {
    const expected = message.floraGPTDebug?.schemaVersionExpected;
    const received = message.floraGPTDebug?.schemaVersionReceived;
    if (!expected || !received || expected === received) return null;
    return React.createElement(
        'span',
        {
            className: 'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600'
        },
        'Schema mismatch'
    );
};
