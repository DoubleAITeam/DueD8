import {
  selectAiBadgeLabel,
  selectIsAiFrozen,
  useAiRuntimeState
} from '../../state/ai';

export function AiGenerationBadge() {
  const label = useAiRuntimeState(selectAiBadgeLabel);
  const isFrozen = useAiRuntimeState(selectIsAiFrozen);

  return (
    <span
      className={`ai-generation-badge${isFrozen ? ' ai-generation-badge--frozen' : ''}`}
      title={isFrozen ? 'AI reset in progress' : 'Latest AI generation active'}
    >
      {label}
    </span>
  );
}
