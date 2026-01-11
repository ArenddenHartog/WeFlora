import type { PcivSourceStatus } from './types';

export type PcivSourceFile = Pick<File, 'name' | 'type' | 'size'>;

const SUPPORTED_EXTENSIONS = ['.txt', '.csv', '.json'];

const isSupportedExtension = (name: string) =>
  SUPPORTED_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

const isSupportedMime = (type: string) =>
  type.startsWith('text/') || type.includes('csv') || type.includes('json');

export const isPcivFileSupported = (file: PcivSourceFile) =>
  isSupportedMime(file.type ?? '') || isSupportedExtension(file.name);

export const getPcivSourceStatus = (file: PcivSourceFile): { status: PcivSourceStatus; error?: string } => {
  if (isPcivFileSupported(file)) {
    return { status: 'pending' };
  }
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  return {
    status: 'unsupported',
    error: isPdf
      ? 'PDF parsing is not supported yet.'
      : 'This file type cannot be parsed yet.'
  };
};
