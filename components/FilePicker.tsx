import React, { useRef } from 'react';

interface FilePickerProps {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onPick: (files: File[]) => void;
  children: (actions: { open: () => void }) => React.ReactNode;
}

const FilePicker: React.FC<FilePickerProps> = ({ accept, multiple = false, disabled = false, onPick, children }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const open = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length > 0) {
      onPick(files);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        type="file"
        ref={inputRef}
        className="hidden"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleChange}
      />
      {children({ open })}
    </>
  );
};

export default FilePicker;
