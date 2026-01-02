import type { ChatMessage } from '../../types';

export type DbMessageInsert = {
  thread_id: string;
  sender: ChatMessage['sender'];
  text: string;
  floragpt_payload?: ChatMessage['floraGPT'] | null;
  citations?: ChatMessage['citations'] | null;
  context_snapshot?: ChatMessage['contextSnapshot'] | null;
  grounding?: ChatMessage['grounding'] | null;
  suggested_actions?: ChatMessage['suggestedActions'] | null;
  created_at?: string | null;
};

export const encodeMessageForDb = (message: ChatMessage, threadId: string): DbMessageInsert => ({
  thread_id: threadId,
  sender: message.sender,
  text: message.text,
  floragpt_payload: message.floraGPT ?? null,
  citations: message.citations ?? null,
  context_snapshot: message.contextSnapshot ?? null,
  grounding: message.grounding ?? null,
  suggested_actions: message.suggestedActions ?? null,
  created_at: message.createdAt ?? null
});

export const decodeMessageFromDb = (row: any): ChatMessage => ({
  id: String(row.id),
  sender: row.sender,
  text: row.text ?? '',
  floraGPT: row.floragpt_payload ?? null,
  citations: row.citations ?? undefined,
  contextSnapshot: row.context_snapshot ?? undefined,
  grounding: row.grounding ?? undefined,
  suggestedActions: row.suggested_actions ?? undefined,
  createdAt: row.created_at ?? undefined
});
