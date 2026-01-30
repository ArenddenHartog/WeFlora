import React, { useMemo } from 'react';
import { escapeHtml, sanitizeHtml } from './documentSanitizer';

interface DocumentViewerProps {
  html?: string | null;
  markdown?: string | null;
  fallback?: React.ReactNode;
  className?: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ html, markdown, fallback, className }) => {
  const sanitized = useMemo(() => {
    if (html) return sanitizeHtml(html);
    if (markdown) return sanitizeHtml(`<pre>${escapeHtml(markdown)}</pre>`);
    return null;
  }, [html, markdown]);

  if (!sanitized) {
    return <>{fallback ?? null}</>;
  }

  return (
    <div
      className={className ?? 'prose prose-sm max-w-none text-slate-800'}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
};

export default DocumentViewer;
