import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LegacyFallbackBadge } from '../components/ChatMessageBadges.ts';

const markup = renderToStaticMarkup(
  React.createElement(LegacyFallbackBadge, {
    message: {
      id: 'msg-1',
      sender: 'ai',
      text: 'Fallback response',
      floraGPTDebug: { fallbackUsed: true, failureReason: 'json-extraction-failed' }
    }
  })
);

assert.ok(markup.includes('Legacy fallback'));

console.log('Fallback badge rendered.');
