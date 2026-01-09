import React, { useMemo, useRef, useState } from 'react';
import type { ActionCard, ActionCardInput, ActionCardSuggestedAction, ExecutionState, PointerPatch } from '../../types';
import {
  InputEl,
  buildPatchesForInputs,
  buildSuggestedActionSubmitArgs,
  normalizeNumberInputValue
} from './actionCardUtils';

type _ActionCardsExecutionState = ExecutionState;
type _ActionCardInput = ActionCardInput;
type _ActionCardSuggestedAction = ActionCardSuggestedAction;

export type ActionCardType = 'deepen' | 'refine' | 'next_step';

export interface ActionCardSubmitResult {
  patches?: PointerPatch[];
  resumeRun?: boolean;
  navigation?: { kind: 'worksheet' | 'report' | 'project'; targetId?: string };
}

export interface ActionCardsProps {
  runId: string;
  cards: ActionCard[];
  blockedStepId?: string;
  onSubmitCard: (args: { cardId: string; cardType: ActionCardType; input?: Record<string, unknown> }) =>
    | Promise<ActionCardSubmitResult>
    | ActionCardSubmitResult;
  onOpenValidation?: (cardId: string) => void;
  onDismissCard?: (cardId: string) => void;
  onRunSuggestedAction?: (args: { label: string; action: string; icon?: string }) => void;
  onOpenEvidenceMap?: () => void;
  contextSummary?: {
    selectedDocsCount: number;
    lastUserConstraints?: string[];
  };
  layout?: 'grid' | 'stack';
  showTypeBadges?: boolean;
  className?: string;
}

const typeCardStyles: Record<ActionCardType, { border: string; accent: string }> = {
  deepen: {
    border: 'border-weflora-mint/60',
    accent: 'text-weflora-teal'
  },
  refine: {
    border: 'border-weflora-mint/60',
    accent: 'text-weflora-teal'
  },
  next_step: {
    border: 'border-weflora-mint/60',
    accent: 'text-weflora-teal'
  }
};

const ActionCards: React.FC<ActionCardsProps> = ({
  cards,
  onSubmitCard,
  onDismissCard,
  onRunSuggestedAction,
  onOpenEvidenceMap,
  contextSummary,
  layout = 'stack',
  showTypeBadges = true,
  className
}) => {
  const [formValues, setFormValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const inputRefs = useRef<Record<string, InputEl | null>>({});

  const setFieldValue = (input: ActionCardInput, value: string | number | boolean) => {
    setFormValues((prev) => ({ ...prev, [input.id]: value }));
  };

  const buildPatches = (inputs: ActionCardInput[]): PointerPatch[] => buildPatchesForInputs(inputs, formValues);

  const allInputsByPointer = useMemo(() => {
    const map: Record<string, ActionCardInput> = {};
    cards.forEach((card) => {
      card.inputs?.forEach((input) => {
        map[input.pointer] = input;
      });
    });
    return map;
  }, [cards]);

  const handleSuggestedAction = (card: ActionCard, action: ActionCardSuggestedAction) => {
    if (onRunSuggestedAction) {
      onRunSuggestedAction(action);
      return;
    }
    if (action.action.startsWith('resolve:')) {
      const pointer = action.action.replace('resolve:', '');
      const input = allInputsByPointer[pointer];
      if (input) {
        inputRefs.current[input.id]?.focus();
      }
      return;
    }
    if (action.action.startsWith('route:')) {
      onSubmitCard(buildSuggestedActionSubmitArgs(card, action));
      return;
    }
    onSubmitCard(buildSuggestedActionSubmitArgs(card, action));
  };

  return (
    <section className={`space-y-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Next best actions</h3>
          <p className="text-xs text-slate-500">Choose the next move in the planning flow.</p>
        </div>
        <div className="flex items-center gap-3">
          {contextSummary && (
            <div className="text-xs text-slate-500">
              {contextSummary.selectedDocsCount} docs · {contextSummary.lastUserConstraints?.length ?? 0} constraints
            </div>
          )}
          {onOpenEvidenceMap && (
            <button
              type="button"
              onClick={onOpenEvidenceMap}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-weflora-mint/60 text-weflora-teal hover:bg-weflora-mint/20"
            >
              Show evidence map
            </button>
          )}
        </div>
      </div>

      <div className={layout === 'grid' ? 'grid gap-4 md:grid-cols-2' : 'space-y-3'}>
        {cards.slice(0, 2).map((card) => {
          const cardStyle = typeCardStyles[card.type];
          const hasSuggestedActions = Boolean(card.suggestedActions?.length);
          const isRefineCard = card.type === 'refine';
          const inputs = card.inputs ?? [];
          const requiredInputs = inputs.filter((input) => input.severity === 'required' || input.required);
          const recommendedInputs = inputs.filter((input) => input.severity === 'recommended');
          const optionalInputs = inputs.filter((input) => input.severity === 'optional');
          const showSuggestedActions = !isRefineCard && hasSuggestedActions;

          const renderInputField = (input: ActionCardInput) => (
            <label key={input.id} className="block text-xs text-slate-600 space-y-1">
              <span className="font-semibold">{input.label}</span>
              {input.type === 'select' ? (
                <select
                  ref={(element) => {
                    inputRefs.current[input.id] = element;
                  }}
                  value={(formValues[input.id] as string | undefined) ?? ''}
                  onChange={(event) => setFieldValue(input, event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                >
                  <option value="" disabled>
                    {input.placeholder ?? 'Select option'}
                  </option>
                  {input.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : input.type === 'number' ? (
                <input
                  ref={(element) => {
                    inputRefs.current[input.id] = element;
                  }}
                  type="number"
                  value={(formValues[input.id] as number | string | undefined) ?? ''}
                  onChange={(event) => {
                    const nextValue = normalizeNumberInputValue(event.target.value);
                    setFieldValue(input, nextValue as number | undefined);
                  }}
                  placeholder={input.placeholder}
                  className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                />
              ) : input.type === 'boolean' ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={(element) => {
                      inputRefs.current[input.id] = element;
                    }}
                    type="checkbox"
                    checked={Boolean(formValues[input.id])}
                    onChange={(event) => setFieldValue(input, event.target.checked)}
                    className="rounded border-slate-300 text-weflora-teal"
                  />
                  <span className="text-xs text-slate-500">{input.placeholder ?? 'Toggle'}</span>
                </div>
              ) : (
                <input
                  ref={(element) => {
                    inputRefs.current[input.id] = element;
                  }}
                  type="text"
                  value={(formValues[input.id] as string | undefined) ?? ''}
                  onChange={(event) => setFieldValue(input, event.target.value)}
                  placeholder={input.placeholder}
                  className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                />
              )}
              {input.helpText && <p className="text-[10px] text-slate-400">{input.helpText}</p>}
              {input.impactNote && input.impactNote !== input.helpText && (
                <p className="text-[10px] text-slate-500">{input.impactNote}</p>
              )}
            </label>
          );

          const renderInputs = (sectionInputs: ActionCardInput[]) => (
            <div className="space-y-3">{sectionInputs.map(renderInputField)}</div>
          );

          return (
            <div key={card.id} className={`rounded-2xl border ${cardStyle.border} bg-white px-4 py-4 space-y-3`}>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800">{card.title}</h4>
                {showTypeBadges && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-weflora-mint/40 text-weflora-teal">
                    {card.type.replace('_', ' ')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600">{card.description}</p>

              {inputs.length > 0 && !isRefineCard && renderInputs(inputs)}

              {isRefineCard && (
                <div className="rounded-xl border border-weflora-mint/50 bg-weflora-mint/20 px-3 py-3 text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-700">Resolve inputs to continue planning.</p>
                  <p>{requiredInputs.length} required · {recommendedInputs.length + optionalInputs.length} recommended</p>
                </div>
              )}

              {showSuggestedActions && (
                <div className="space-y-2">
                  {card.suggestedActions?.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => {
                        handleSuggestedAction(card, action);
                      }}
                      className="w-full flex items-center justify-between rounded-lg border border-weflora-mint/60 px-3 py-2 text-xs text-weflora-teal hover:bg-weflora-mint/20"
                    >
                      <span>{action.label}</span>
                      <span className={`${cardStyle.accent}`}>{'→'}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2">
                {isRefineCard && (
                  <button
                    onClick={() => onOpenValidation?.(card.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-weflora-mint/60 text-weflora-teal hover:bg-weflora-mint/20"
                  >
                    Resolve inputs
                  </button>
                )}
                {!hasSuggestedActions && !isRefineCard && (
                  <button
                    onClick={() =>
                      onSubmitCard({
                        cardId: card.id,
                        cardType: card.type,
                        input: card.inputs ? { patches: buildPatches(card.inputs) } : undefined
                      })
                    }
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-weflora-teal text-white hover:bg-weflora-dark"
                  >
                    Use Card
                  </button>
                )}
                {onDismissCard && (
                  <button
                    onClick={() => onDismissCard(card.id)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ActionCards;
