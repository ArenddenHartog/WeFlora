export const FEATURES = {
  workspaces: false,
  species: false,
  tasks: false,
  comments: false,
  // GlobalTopBar icon-only quick ask panel (must not navigate). Keep disabled by default.
  quickAskPanel: false,
  floragpt_modes_v0: import.meta.env.VITE_FLORAGPT_MODES_V0 === 'true',
  // Worksheet-aware FloraGPT actions and context packing (feature-flagged).
  floragpt_worksheet_v0: import.meta.env.VITE_FLORAGPT_WORKSHEET_V0 === 'true',
} as const;
