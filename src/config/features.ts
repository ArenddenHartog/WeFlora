const env = ((import.meta as ImportMeta & { env?: Record<string, string> }).env ?? process.env) as Record<
  string,
  string | undefined
>;

export const FEATURES = {
  workspaces: false,
  species: false,
  tasks: false,
  comments: false,
  // GlobalTopBar icon-only quick ask panel (must not navigate). Keep disabled by default.
  quickAskPanel: false,
  floragpt_modes_v0: env.VITE_FLORAGPT_MODES_V0 === 'true',
  // Worksheet-aware FloraGPT actions and context packing (feature-flagged).
  floragpt_worksheet_v0: env.VITE_FLORAGPT_WORKSHEET_V0 === 'true',
  pcivDebug: env.VITE_PCIV_DEBUG === 'true',
  pciv: env.VITE_PCIV
    ? env.VITE_PCIV === 'true'
    : env.VITE_PCIV_V0
        ? env.VITE_PCIV_V0 === 'true'
        : env.NODE_ENV !== 'production'
} as const;
