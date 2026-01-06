export interface RouteActionHandlers {
  action: string;
  onPromoteToWorksheet?: () => void;
  onDraftReport?: () => void;
  toast?: (message: string) => void;
}

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
