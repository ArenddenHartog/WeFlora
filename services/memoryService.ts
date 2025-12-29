import { supabase } from './supabaseClient';
import { aiService } from './aiService';
import type { ChatMessage, MemoryItem, MemoryPolicy, MemorySummary } from '../types';

export const DEFAULT_MEMORY_POLICY: MemoryPolicy = {
    userId: '',
    shortTermWindow: 10,
    topN: 5,
    summaryTrigger: 18,
    summaryMinGapMinutes: 30,
    memoryEnabled: true,
    allowSummaries: true,
    maxMemoryItems: 120
};

const mapPolicyRow = (userId: string, row: any): MemoryPolicy => {
    return {
        userId,
        shortTermWindow: row?.short_term_window ?? DEFAULT_MEMORY_POLICY.shortTermWindow,
        topN: row?.top_n ?? DEFAULT_MEMORY_POLICY.topN,
        summaryTrigger: row?.summary_trigger ?? DEFAULT_MEMORY_POLICY.summaryTrigger,
        summaryMinGapMinutes: row?.summary_min_gap_minutes ?? DEFAULT_MEMORY_POLICY.summaryMinGapMinutes,
        memoryEnabled: row?.memory_enabled ?? DEFAULT_MEMORY_POLICY.memoryEnabled,
        allowSummaries: row?.allow_summaries ?? DEFAULT_MEMORY_POLICY.allowSummaries,
        maxMemoryItems: row?.max_memory_items ?? DEFAULT_MEMORY_POLICY.maxMemoryItems,
        id: row?.id
    };
};

const mapMemoryRow = (row: any): MemoryItem => ({
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    content: row.content,
    sourceThreadId: row.source_thread_id || undefined,
    metadata: row.metadata || undefined,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at || undefined,
    importance: row.importance || undefined
});

export const getOrCreateMemoryPolicy = async (userId: string): Promise<MemoryPolicy> => {
    if (!userId) return { ...DEFAULT_MEMORY_POLICY, userId };

    const { data, error } = await supabase
        .from('memory_policies')
        .select('*')
        .eq('user_id', userId)
        .limit(1);

    if (error) {
        console.warn('Failed to fetch memory policy', error);
        return { ...DEFAULT_MEMORY_POLICY, userId };
    }

    if (!data || data.length === 0) {
        const payload = {
            user_id: userId,
            short_term_window: DEFAULT_MEMORY_POLICY.shortTermWindow,
            top_n: DEFAULT_MEMORY_POLICY.topN,
            summary_trigger: DEFAULT_MEMORY_POLICY.summaryTrigger,
            summary_min_gap_minutes: DEFAULT_MEMORY_POLICY.summaryMinGapMinutes,
            memory_enabled: DEFAULT_MEMORY_POLICY.memoryEnabled,
            allow_summaries: DEFAULT_MEMORY_POLICY.allowSummaries,
            max_memory_items: DEFAULT_MEMORY_POLICY.maxMemoryItems
        };

        const { data: inserted, error: insertError } = await supabase
            .from('memory_policies')
            .insert(payload)
            .select()
            .limit(1);

        if (insertError) {
            console.warn('Failed to create memory policy', insertError);
            return { ...DEFAULT_MEMORY_POLICY, userId };
        }

        return mapPolicyRow(userId, inserted?.[0]);
    }

    return mapPolicyRow(userId, data[0]);
};

export const fetchTopMemoryItems = async (userId: string, limit: number): Promise<MemoryItem[]> => {
    if (!userId || limit <= 0) return [];

    const { data, error } = await supabase
        .from('memory_items')
        .select('*')
        .eq('user_id', userId)
        .order('last_used_at', { ascending: false, nullsFirst: false })
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.warn('Failed to fetch memory items', error);
        return [];
    }

    const items = (data || []).map(mapMemoryRow);
    const ids = items.map(item => item.id);

    if (ids.length > 0) {
        await supabase
            .from('memory_items')
            .update({ last_used_at: new Date().toISOString() })
            .in('id', ids);
    }

    return items;
};

export const fetchRecentThreadMessages = async (threadId: string, limit: number): Promise<ChatMessage[]> => {
    if (!threadId || limit <= 0) return [];

    const { data, error } = await supabase
        .from('messages')
        .select('id, sender, text, created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.warn('Failed to fetch recent messages', error);
        return [];
    }

    return (data || [])
        .map((row: any) => ({
            id: row.id,
            sender: row.sender,
            text: row.text,
            createdAt: row.created_at
        }))
        .reverse();
};

const formatConversationHistory = (messages: ChatMessage[]): string => {
    return messages
        .map((message) => {
            const role = message.sender === 'user' ? 'User' : 'Assistant';
            return `${role}: ${String(message.text || '').trim()}`;
        })
        .filter(line => line.trim().length > 0)
        .join('\n');
};

export const buildPromptWithHistory = (userText: string, recentMessages: ChatMessage[]): string => {
    const normalizedText = String(userText || '').trim();
    const history = [...recentMessages];

    if (history.length > 0) {
        const last = history[history.length - 1];
        if (last.sender === 'user' && String(last.text || '').trim() === normalizedText) {
            history.pop();
        }
    }

    const historyBlock = formatConversationHistory(history);

    if (!historyBlock) {
        return normalizedText;
    }

    return `Conversation history (most recent turns):\n${historyBlock}\n\nUser: ${normalizedText}`;
};

const buildMemoryItemsText = (items: MemoryItem[]): string => {
    if (!items.length) return '';
    return items
        .map(item => `- (${item.kind}) ${item.content}`)
        .join('\n');
};

export const buildMemoryInstruction = (items: MemoryItem[]): string => {
    if (!items.length) return '';
    return [
        'LONG-TERM USER MEMORY (apply only if relevant):',
        buildMemoryItemsText(items),
        'If a memory item conflicts with the current user message, ask a clarifying question instead of assuming.'
    ].join('\n');
};

export const runMemoryQaChecks = (args: {
    userId: string;
    policy: MemoryPolicy;
    memoryItems: MemoryItem[];
}): { ok: boolean; issues: string[] } => {
    const issues: string[] = [];

    if (!args.userId) {
        issues.push('Missing user id for memory retrieval.');
    }

    if (!args.policy.memoryEnabled && args.memoryItems.length > 0) {
        issues.push('Memory items retrieved while memory is disabled.');
    }

    const mismatch = args.memoryItems.find(item => item.userId !== args.userId);
    if (mismatch) {
        issues.push('Memory items contain data from a different user.');
    }

    if (args.policy.memoryEnabled && args.policy.topN > 0 && args.memoryItems.length === 0) {
        issues.push('Memory enabled but no memory items retrieved.');
    }

    return { ok: issues.length === 0, issues };
};

const storeMemoryItems = async (userId: string, threadId: string | null, items: { kind: MemoryItem['kind']; content: string }[], metadata?: Record<string, any>) => {
    if (!userId || items.length === 0) return;

    const payload = items.map(item => ({
        user_id: userId,
        kind: item.kind,
        content: item.content,
        source_thread_id: threadId,
        metadata: metadata || null
    }));

    const { error } = await supabase
        .from('memory_items')
        .insert(payload);

    if (error) {
        console.warn('Failed to store memory items', error);
    }
};

const pruneMemoryItems = async (userId: string, maxItems: number) => {
    if (!userId || maxItems <= 0) return;

    const { data, error } = await supabase
        .from('memory_items')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(maxItems, maxItems + 200);

    if (error) {
        console.warn('Failed to prune memory items', error);
        return;
    }

    const ids = (data || []).map((row: any) => row.id);
    if (ids.length > 0) {
        await supabase
            .from('memory_items')
            .delete()
            .in('id', ids);
    }
};

const shouldSummarize = (policy: MemoryPolicy, lastSummaryAt?: string) => {
    if (!lastSummaryAt) return true;
    const last = new Date(lastSummaryAt).getTime();
    if (Number.isNaN(last)) return true;
    const minutesSince = (Date.now() - last) / 60000;
    return minutesSince >= policy.summaryMinGapMinutes;
};

const extractSummaryMetadata = (summary: MemorySummary, messageCount: number) => ({
    profile: summary.profile,
    preferences: summary.preferences,
    stableFacts: summary.stableFacts,
    messageCount
});

export const maybeSummarizeThread = async (args: {
    userId: string;
    threadId: string;
    policy: MemoryPolicy;
}): Promise<void> => {
    const { userId, threadId, policy } = args;
    if (!userId || !threadId) return;
    if (!policy.memoryEnabled || !policy.allowSummaries) return;

    const { data: summaryRows } = await supabase
        .from('memory_items')
        .select('created_at, metadata')
        .eq('user_id', userId)
        .eq('kind', 'summary')
        .eq('source_thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(1);

    const lastSummary = summaryRows?.[0];
    const lastSummaryMessageCount = Number(lastSummary?.metadata?.messageCount || 0);

    if (!shouldSummarize(policy, lastSummary?.created_at)) return;

    const { count, error: countError } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('thread_id', threadId);

    if (countError || !count) {
        if (countError) console.warn('Failed to count messages', countError);
        return;
    }

    if (count - lastSummaryMessageCount < policy.summaryTrigger) return;

    const summaryCount = Math.max(0, count - policy.shortTermWindow);
    if (summaryCount <= 0) return;

    const { data: messages, error: messageError } = await supabase
        .from('messages')
        .select('id, sender, text, created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(summaryCount);

    if (messageError) {
        console.warn('Failed to fetch messages for summary', messageError);
        return;
    }

    const historyText = formatConversationHistory(
        (messages || []).map((row: any) => ({
            id: row.id,
            sender: row.sender,
            text: row.text,
            createdAt: row.created_at
        }))
    );

    if (!historyText.trim()) return;

    const summary = await aiService.summarizeUserMemory(historyText);
    if (!summary) return;

    const memoryItems: { kind: MemoryItem['kind']; content: string }[] = [];
    summary.profile.forEach(item => memoryItems.push({ kind: 'profile', content: item }));
    summary.preferences.forEach(item => memoryItems.push({ kind: 'preference', content: item }));
    summary.stableFacts.forEach(item => memoryItems.push({ kind: 'fact', content: item }));

    const metadata = extractSummaryMetadata(summary, count);

    await storeMemoryItems(userId, threadId, memoryItems, metadata);
    await storeMemoryItems(userId, threadId, [{ kind: 'summary', content: summary.summary }], metadata);
    await pruneMemoryItems(userId, policy.maxMemoryItems);
};

export const forgetUserMemory = async (userId: string): Promise<void> => {
    if (!userId) return;

    await supabase
        .from('memory_items')
        .delete()
        .eq('user_id', userId);

    await supabase
        .from('memory_policies')
        .update({ memory_enabled: false })
        .eq('user_id', userId);
};
