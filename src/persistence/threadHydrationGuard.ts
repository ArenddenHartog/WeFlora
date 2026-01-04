import type { ChatMessage } from '../../types';

export const applyThreadHydrationGuard = (args: {
  prevMessages: ChatMessage[];
  incomingMessages: ChatMessage[];
  lastHydratedThreadId: string | null;
  threadId: string;
}): { nextMessages: ChatMessage[]; nextHydratedThreadId: string } => {
  const { prevMessages, incomingMessages, lastHydratedThreadId, threadId } = args;
  if (lastHydratedThreadId !== threadId) {
    return { nextMessages: incomingMessages, nextHydratedThreadId: threadId };
  }
  const prevHasStructured = prevMessages.some((msg) => msg.floraGPT || msg.citations?.length || msg.grounding || msg.suggestedActions || msg.contextSnapshot);
  const incomingHasStructured = incomingMessages.some((msg) => msg.floraGPT || msg.citations?.length || msg.grounding || msg.suggestedActions || msg.contextSnapshot);
  if (prevMessages.length > 0 && prevHasStructured && !incomingHasStructured) {
    return { nextMessages: prevMessages, nextHydratedThreadId: threadId };
  }
  return { nextMessages: incomingMessages, nextHydratedThreadId: threadId };
};
