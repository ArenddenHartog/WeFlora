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

const AssumptionsModule: React.FC<AssumptionsModuleProps> = ({ items }) => {
  if (items.length === 0) {
    return <div className="text-sm text-slate-500">No assumptions recorded.</div>;
  }

  return (
    <div className="space-y-3 text-sm text-slate-600">
      {items.map((item) => (
        <div key={item.id} className="border-b border-slate-100 pb-3">
          <p className="text-slate-800 font-medium">{item.claim}</p>
          <div className="mt-1 text-xs text-slate-500">Basis: {item.basis}</div>
          <div className="mt-1 text-xs text-slate-500">How to validate: {item.howToValidate}</div>
          <div className="mt-1 text-xs text-slate-500">
            Confidence: {item.confidence} · Owner: {item.owner}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AssumptionsModule;
