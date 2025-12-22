export const ALLOWLIST_ASK_SURFACES = [
  // Primary composer surfaces
  'components/ChatInput.tsx',
  'components/HomeView.tsx',
  'components/ChatView.tsx',
  // Global escalation (search → research)
  'components/GlobalTopBar.tsx',
] as const;

export const AI_TOKENS = {
  // Default AI evidence tint
  tintBg: 'bg-weflora-teal/10',
  tintBorder: 'border-weflora-teal/20',
  text: 'text-weflora-dark',

  // Status semantics
  success: 'weflora-success',
  warning: 'weflora-amber',
  error: 'weflora-red',
} as const;

export function isAllowedAskSurface(surfaceId: string): boolean {
  return (ALLOWLIST_ASK_SURFACES as readonly string[]).includes(surfaceId);
}

