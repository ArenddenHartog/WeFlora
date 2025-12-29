# File System Inventory

## Upload entry points
- `components/ProjectWorkspace.tsx`: Project files tab upload button/empty state.
- `components/KnowledgeBaseView.tsx`: Files Hub upload button and modal target selection.
- `components/ColumnSettingsModal.tsx`: Skill “Files” tab upload button.
- `components/WorksheetWizard.tsx`: Worksheet import wizard “Click to upload document.”
- `components/WorksheetContainer.tsx`: Worksheet toolbar “Import Data.”
- `components/ReportWizard.tsx`: Report wizard “Import Document.”
- `components/ChatInput.tsx`: Context picker “Upload Local File.”

## File usage / attachment points
- `components/ChatInput.tsx`: Context picker for project files, reports, worksheets.
- `contexts/ChatContext.tsx`: Resolves project file IDs to `File` objects for AI context.
- `components/MatrixView.tsx`: Skill configuration `attachedContextIds` for per-column AI context.
- `components/KnowledgeBaseView.tsx`: Files Hub listing and AI action entry point.
- `components/FilePreview.tsx`: File preview/download experience.

## Central upload & registry
- `services/fileService.ts`: File entity model mapping, validation, upload pipeline, lifecycle actions.
- `contexts/ProjectContext.tsx`: Uses centralized upload service to register + store files and update UI state.
