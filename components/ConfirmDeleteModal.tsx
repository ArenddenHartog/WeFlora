import React from 'react';
import BaseModal from './BaseModal';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-weflora-red text-white rounded-lg hover:bg-weflora-red/80 text-sm font-bold transition-colors"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{description}</p>
    </BaseModal>
  );
};

export default ConfirmDeleteModal;

