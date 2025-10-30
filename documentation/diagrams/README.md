# ABCResearch Architecture Diagram

This directory contains the official architecture diagram for the ABCResearch system, created using Mermaid.

## File

- **`architecture_diagram.md`** - **Official architecture diagram** with bidirectional data flow and component ownership mapping
  - Comprehensive system architecture showing all layers and components
  - Bidirectional request-response patterns between layers
  - **Component ownership mapping** for Fredrik and Sofie based on git history
  - Elements, interfaces, and interactions clearly assigned to owners
  - Task mapping for ABC-41, ABC-45, and ABC-46

## Key Sections

The architecture diagram includes:

1. **System Architecture (Mermaid Diagram)**
   - Frontend Layer (React components)
   - Client Services (business logic)
   - API Gateway (Vercel serverless functions)
   - External APIs (ClinicalTrials.gov, PubMed, Claude, Gemini)
   - Data Layer (Supabase, PostgreSQL)
   - Observability & Events

2. **Component Ownership**
   - Fredrik's components: ChatAPI, ChatUI, ProjectService
   - Sofie's components: PipelineAPI, PipelineUI, EnhanceAPI, DrugAPI, GatherService, PipelineService
   - Shared components and external dependencies clearly marked

3. **Task Mapping**
   - ABC-41: Dynamic AI Response Generation
   - ABC-45: Search Term Extraction Bug Fix
   - ABC-46: Intelligent Medical Term Detection

## Viewing the Diagram

The diagram uses Mermaid syntax embedded in markdown.

**To preview in VSCode:**
1. Open `architecture_diagram.md`
2. Press `Cmd+Shift+V` (Mac) or `Ctrl+Shift+V` (Windows/Linux)
3. The diagram will render in the preview panel

**Required Extension:**
- Install **"Markdown Preview Mermaid Support"** from the VSCode marketplace for diagram rendering

## Diagram Features

- **Color-coded nodes** for visual component categorization
- **Bidirectional arrows** showing request-response patterns
- **Interface dots** at major connection points
- **Line references** for precise component location in documentation
- **Ownership attribution** with file paths and implementation details

