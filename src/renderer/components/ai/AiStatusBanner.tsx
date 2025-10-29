import { useEffect } from 'react';
import {
  useAiRuntimeState,
  selectAiBannerMessage,
  selectIsAiFrozen
} from '../../state/ai';

export function AiStatusBanner() {
  const isFrozen = useAiRuntimeState(selectIsAiFrozen);
  const message = useAiRuntimeState(selectAiBannerMessage);
  const refresh = useAiRuntimeState((state) => state.refresh);
  const loading = useAiRuntimeState((state) => state.loading);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  if (!isFrozen) {
    return null;
  }

  return (
    <div className="ai-status-banner-wrapper">
      <div className="ai-status-banner" role="status" aria-live="polite">
        <span className="ai-status-indicator" aria-hidden="true" />
        <span>{message}</span>
        {loading ? <span className="ai-status-loading">Refreshing…</span> : null}
      </div>
    </div>
  );
}
