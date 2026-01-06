export interface RouteActionHandlers {
  action: string;
  onPromoteToWorksheet?: () => void;
  onDraftReport?: () => void;
  toast?: (message: string) => void;
}

export interface RouteLogEntry {
  level: 'info';
  message: string;
  data: { runId: string; action: string };
  timestamp: string;
}

export const buildRouteLogEntry = (args: { action: string; runId: string }): RouteLogEntry => ({
  level: 'info',
  message: args.action === 'route:worksheet' ? 'User routed run to worksheet' : 'User routed run to report',
  data: { runId: args.runId, action: args.action },
  timestamp: new Date().toISOString()
});

export const handleRouteAction = ({ action, onPromoteToWorksheet, onDraftReport, toast }: RouteActionHandlers): boolean => {
  if (action === 'route:worksheet') {
    onPromoteToWorksheet?.();
    return true;
  }
  if (action === 'route:report') {
    if (onDraftReport) {
      onDraftReport();
    } else {
      toast?.('Report drafting not yet implemented');
    }
    return true;
  }
  return false;
};
