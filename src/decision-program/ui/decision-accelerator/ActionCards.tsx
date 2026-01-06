import React, { useMemo, useRef, useState } from 'react';
import type { ActionCard, ActionCardInput, ActionCardSuggestedAction, ExecutionState, PointerPatch } from '../../types';

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
  onDismissCard?: (cardId: string) => void;
  onRunSuggestedAction?: (args: { label: string; action: string; icon?: string }) => void;
  contextSummary?: {
    selectedDocsCount: number;
    lastUserConstraints?: string[];
  };
  layout?: 'grid' | 'stack';
  showTypeBadges?: boolean;
  className?: string;
}

const typeBadgeStyles: Record<ActionCardType, string> = {
  deepen: 'bg-indigo-50 text-indigo-700',
  refine: 'bg-amber-50 text-amber-700',
  next_step: 'bg-emerald-50 text-emerald-700'
};

const ActionCards: React.FC<ActionCardsProps> = ({
  runId,
  cards,
  onSubmitCard,
  onDismissCard,
  onRunSuggestedAction,
  contextSummary,
  layout = 'grid',
  showTypeBadges = true,
  className
}) => {
  const [formValues, setFormValues] = useState<Record<string, string | number | boolean>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});

  const setFieldValue = (input: ActionCardInput, value: string | number | boolean) => {
    setFormValues((prev) => ({ ...prev, [input.id]: value }));
  };

  const buildPatches = (inputs: ActionCardInput[]): PointerPatch[] =>
    inputs.map((input) => ({
      pointer: input.pointer,
      value: formValues[input.id]
    }));

  const hasMissingRequired = (inputs: ActionCardInput[]) =>
    inputs.some((input) => input.required && (formValues[input.id] === undefined || formValues[input.id] === ''));

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
    onSubmitCard({ cardId: card.id, cardType: card.type, input: { action: action.action } });
  };

  return (
    <section className={`space-y-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Action Cards</h3>
          <p className="text-xs text-slate-500">Run {runId}</p>
        </div>
        {contextSummary && (
          <div className="text-xs text-slate-500">
            {contextSummary.selectedDocsCount} docs · {contextSummary.lastUserConstraints?.length ?? 0} constraints
          </div>
        )}
      </div>

      <div className={layout === 'grid' ? 'grid gap-4 md:grid-cols-3' : 'space-y-3'}>
        {cards.map((card) => (
          <div key={card.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">{card.title}</h4>
                <p className="text-xs text-slate-500 mt-1">{card.description}</p>
              </div>
              {showTypeBadges && (
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    typeBadgeStyles[card.type]
                  }`}
                >
                  {card.type}
                </span>
              )}
            </div>

            {card.inputs && card.inputs.length > 0 && (
              <div className="mt-3 space-y-3">
                {card.inputs.map((input) => (
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
                        onChange={(event) => setFieldValue(input, Number(event.target.value))}
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
                  </label>
                ))}
              </div>
            )}

            {card.suggestedActions && card.suggestedActions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {card.suggestedActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => {
                      handleSuggestedAction(card, action);
                    }}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() =>
                  onSubmitCard({
                    cardId: card.id,
                    cardType: card.type,
                    input: card.inputs ? { patches: buildPatches(card.inputs) } : undefined
                  })
                }
                disabled={card.type === 'refine' && card.inputs ? hasMissingRequired(card.inputs) : false}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                  card.type === 'refine' && card.inputs && hasMissingRequired(card.inputs)
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-weflora-teal text-white hover:bg-weflora-dark'
                }`}
              >
                Use Card
              </button>
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
        ))}
      </div>
    </section>
  );
};

export default ActionCards;
