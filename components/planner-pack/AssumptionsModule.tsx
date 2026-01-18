import React from 'react';

export interface AssumptionItem {
  id: string;
  claim: string;
  basis: string;
  howToValidate: string;
  confidence: 'Low' | 'Medium' | 'High';
  owner: 'WeFlora' | 'Planner';
}

interface AssumptionsModuleProps {
  items: AssumptionItem[];
}

const confidenceStyles: Record<AssumptionItem['confidence'], string> = {
  High: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low: 'bg-rose-50 text-rose-700 border-rose-200'
};

const ownerStyles: Record<AssumptionItem['owner'], string> = {
  WeFlora: 'bg-slate-50 text-slate-600 border-slate-200',
  Planner: 'bg-blue-50 text-blue-700 border-blue-200'
};

const AssumptionsModule: React.FC<AssumptionsModuleProps> = ({ items }) => {
  if (items.length === 0) {
    return <div className="text-xs text-slate-500">No assumptions declared.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-slate-500">
        <div className="col-span-5">Claim</div>
        <div className="col-span-3">Basis</div>
        <div className="col-span-4">How to validate</div>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-12 gap-2 border border-slate-200 rounded-lg p-3 bg-white">
            <div className="col-span-5 text-sm text-slate-800 font-medium">{item.claim}</div>
            <div className="col-span-3 text-xs text-slate-600">{item.basis}</div>
            <div className="col-span-4 text-xs text-slate-600">{item.howToValidate}</div>
            <div className="col-span-12 flex flex-wrap gap-2 mt-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${confidenceStyles[item.confidence]}`}>
                Confidence: {item.confidence}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ownerStyles[item.owner]}`}>
                Owner: {item.owner}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssumptionsModule;
