import React, { useMemo, useRef, useState } from 'react';
import type { ActionCard, ActionCardInput, ActionCardSuggestedAction, ExecutionState, PointerPatch } from '../../types';
import {
  InputEl,
  buildPatchesForInputs,
  buildSuggestedActionSubmitArgs,
  normalizeNumberInputValue,
  shouldDisableRefine
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

const typeCardStyles: Record<ActionCardType, { header: string; border: string; accent: string }> = {
  deepen: {
    header: 'bg-indigo-50 text-indigo-900',
    border: 'border-indigo-100',
    accent: 'text-indigo-600'
  },
  refine: {
    header: 'bg-amber-50 text-amber-900',
    border: 'border-amber-100',
    accent: 'text-amber-600'
  },
  next_step: {
    header: 'bg-emerald-50 text-emerald-900',
    border: 'border-emerald-100',
    accent: 'text-emerald-600'
  }
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
  const [formValues, setFormValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const inputRefs = useRef<Record<string, InputEl | null>>({});
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const groupOrder = ['site', 'regulatory', 'equity', 'species', 'supply'] as const;
  const groupLabels: Record<string, string> = {
    site: 'Site',
    regulatory: 'Regulatory',
    equity: 'Equity',
    species: 'Species',
    supply: 'Supply'
  };

  const getGroupFromPointer = (pointer: string) => {
    if (pointer.includes('/context/site/')) return 'site';
    if (pointer.includes('/context/regulatory/')) return 'regulatory';
    if (pointer.includes('/context/equity/')) return 'equity';
    if (pointer.includes('/context/species/')) return 'species';
    if (pointer.includes('/context/supply/')) return 'supply';
    return 'site';
  };

  const setFieldValue = (input: ActionCardInput, value: string | number | boolean) => {
    setFormValues((prev) => ({ ...prev, [input.id]: value }));
  };

  const buildPatches = (inputs: ActionCardInput[]): PointerPatch[] => buildPatchesForInputs(inputs, formValues);
  const hasMissingRequired = (inputs: ActionCardInput[]) => shouldDisableRefine(inputs, formValues);

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
        {cards.map((card) => {
          const cardStyle = typeCardStyles[card.type];
          const hasSuggestedActions = Boolean(card.suggestedActions?.length);
          const isRefineCard = card.type === 'refine';
          const inputs = card.inputs ?? [];
          const requiredInputs = inputs.filter((input) => input.severity === 'required' || input.required);
          const recommendedInputs = inputs.filter((input) => input.severity === 'recommended');
          const optionalInputs = inputs.filter((input) => input.severity === 'optional');
          const missingRecommended =
            recommendedInputs.filter((input) => formValues[input.id] === undefined || formValues[input.id] === '').length > 0;
          const hasSafeDefaults = Boolean(
            card.suggestedActions?.some((action) => action.action === 'refine:apply-defaults')
          );
          const availableGroups = groupOrder.filter((group) =>
            inputs.some((input) => getGroupFromPointer(input.pointer) === group)
          );
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

          const renderInputs = (sectionInputs: ActionCardInput[]) => {
            if (!isRefineCard) {
              return <div className="space-y-3">{sectionInputs.map(renderInputField)}</div>;
            }
            const grouped = groupOrder
              .map((group) => ({
                group,
                inputs: sectionInputs.filter((input) => getGroupFromPointer(input.pointer) === group)
              }))
              .filter((entry) => entry.inputs.length > 0);
            return (
              <div className="space-y-4">
                {grouped.map(({ group, inputs }) => (
                  <div key={group} className="space-y-3">
                    <div
                      ref={(element) => {
                        if (!groupRefs.current[group]) {
                          groupRefs.current[group] = element;
                        }
                      }}
                      className="text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                    >
                      {groupLabels[group]}
                    </div>
                    {inputs.map(renderInputField)}
                  </div>
                ))}
              </div>
            );
          };

          return (
            <div
              key={card.id}
              className={`rounded-2xl border ${cardStyle.border} bg-white shadow-sm overflow-hidden`}
            >
              <div className={`px-4 py-3 ${cardStyle.header}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold">{card.title}</h4>
                    <p className="text-xs opacity-80 mt-1">{card.description}</p>
                  </div>
                  {showTypeBadges && (
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${typeBadgeStyles[card.type]}`}
                    >
                      {card.type}
                    </span>
                  )}
                </div>
              </div>

              <div className="px-4 py-4 space-y-4">
                {isRefineCard && missingRecommended && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                    Some inputs were inferred or left unspecified. Results may be broader or less site-specific.
                  </div>
                )}

                {isRefineCard && availableGroups.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {availableGroups.map((group) => (
                      <button
                        key={group}
                        onClick={() => groupRefs.current[group]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      >
                        Jump to {groupLabels[group]}
                      </button>
                    ))}
                  </div>
                )}

                {inputs.length > 0 && (
                  <div className="space-y-4">
                    {requiredInputs.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                          Required
                        </p>
                        {renderInputs(requiredInputs)}
                      </div>
                    )}
                    {recommendedInputs.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                          Recommended
                        </p>
                        {renderInputs(recommendedInputs)}
                      </div>
                    )}
                    {optionalInputs.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                          Optional
                        </p>
                        {renderInputs(optionalInputs)}
                      </div>
                    )}
                  </div>
                )}

                {showSuggestedActions && (
                  <div className="flex flex-wrap gap-2">
                    {card.suggestedActions?.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => {
                          handleSuggestedAction(card, action);
                        }}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 ${cardStyle.accent}`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {isRefineCard && hasSafeDefaults && (
                    <button
                      onClick={() =>
                        handleSuggestedAction(card, { label: 'Apply safe defaults', action: 'refine:apply-defaults' })
                      }
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    >
                      Apply safe defaults
                    </button>
                  )}
                  {isRefineCard && (
                    <button
                      onClick={() =>
                        onSubmitCard({
                          cardId: card.id,
                          cardType: card.type,
                          input: {
                            action: 'refine:continue',
                            patches: card.inputs ? buildPatches(card.inputs) : undefined
                          }
                        })
                      }
                      disabled={card.inputs ? hasMissingRequired(card.inputs) : false}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                        card.inputs && hasMissingRequired(card.inputs)
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-weflora-teal text-white hover:bg-weflora-dark'
                      }`}
                    >
                      Continue
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
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ActionCards;
