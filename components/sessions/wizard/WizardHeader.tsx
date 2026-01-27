import React from 'react';
import { SparklesIcon } from '../../icons';

interface WizardHeaderProps {
  title: string;
  description: string;
}

const WizardHeader: React.FC<WizardHeaderProps> = ({ title, description }) => {
  return (
    <div className="mb-8 flex items-start gap-4">
      <div className="h-10 w-10 rounded-xl bg-weflora-mint/15 text-weflora-teal flex items-center justify-center">
        <SparklesIcon className="h-5 w-5" />
      </div>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
};

export default WizardHeader;
