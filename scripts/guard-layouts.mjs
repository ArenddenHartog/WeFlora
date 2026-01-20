#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const layoutFiles = [
  'components/HomeView.tsx',
  'components/ProjectsView.tsx',
  'components/ResearchHistoryView.tsx',
  'components/ChatView.tsx',
  'components/KnowledgeBaseView.tsx',
  'components/PromptTemplatesView.tsx',
  'components/LibraryView.tsx',
  'components/ReportsHubView.tsx',
  'components/WorksheetTemplatesView.tsx',
  'components/agentic/SkillsIndex.tsx',
  'components/agentic/SkillDetail.tsx',
  'components/agentic/FlowsIndex.tsx',
  'components/agentic/FlowDetail.tsx',
  'components/agentic/RunsIndex.tsx',
  'components/agentic/RunDetail.tsx',
  'components/planning/PlanningView.tsx',
  'components/planning/pciv/PCIVFlow.tsx',
  'components/planner-pack/PlannerPackIndex.tsx',
  'components/planner-pack/PlannerPackDetail.tsx'
];

const forbiddenExact = ['min-h-screen', 'h-screen', 'h-full'];
const overflowToken = /\boverflow-[^\s"']+/g;

const errors = [];

for (const relativePath of layoutFiles) {
  const filePath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`[layout-guard] Missing file: ${relativePath}`);
    continue;
  }

  const src = fs.readFileSync(filePath, 'utf8');
  const matches = Array.from(src.matchAll(/<[^>]*data-layout-root[^>]*>/g));

  if (matches.length === 0) {
    errors.push(`[layout-guard] Missing data-layout-root in ${relativePath}`);
    continue;
  }

  for (const match of matches) {
    const tag = match[0];
    const classMatch = tag.match(/className=\"([^\"]*)\"/);
    if (!classMatch) {
      errors.push(`[layout-guard] data-layout-root tag without className in ${relativePath}: ${tag}`);
      continue;
    }

    const classValue = classMatch[1];
    for (const token of forbiddenExact) {
      if (classValue.split(/\s+/).includes(token)) {
        errors.push(`[layout-guard] Forbidden class "${token}" in ${relativePath}`);
      }
    }

    const overflowMatches = classValue.match(overflowToken);
    if (overflowMatches) {
      errors.push(`[layout-guard] Overflow utilities not allowed on layout root in ${relativePath}: ${overflowMatches.join(', ')}`);
    }
  }
}

if (errors.length > 0) {
  console.error('Layout guard failed:\n');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('layout-guard passed');
