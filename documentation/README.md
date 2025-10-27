# ABCresearch Documentation

Welcome to the ABCresearch documentation. This comprehensive guide covers all aspects of the AI-powered pharmaceutical research platform.

## What is ABCresearch?

ABCresearch is an intelligent research assistant that helps pharmaceutical researchers discover and analyze drug candidates through:
- AI-powered discovery-focused search across clinical trials and research papers
- Automatic drug extraction and grouping with AI
- Market map visualization and competitive analysis
- Asset development pipeline tracking
- Conversational AI interface for data exploration

## Documentation Structure

The documentation is organized sequentially for easy navigation:

### Core Documentation

**[0. Overview](./0-overview.md)** - Start here for a high-level understanding of the platform

**[1. Frontend](./1-frontend.md)** - React architecture, components, and client-side services

**[2. Backend](./2-backend.md)** - API endpoints, serverless functions, and AI integration

**[3. Database](./3-database.md)** - Project-centric database design (Supabase/PostgreSQL)

### Asset Pipeline Documentation

**[4. Asset Pipeline](./4-asset-pipeline.md)** - Drug candidate table view and automatic classification

**[5. Pipeline Drug Matching](./5-pipeline-drug-matching.md)** - How drug modals connect to pipeline data

**[6. Pipeline LLM Strategy](./6-pipeline-llm-strategy.md)** - AI extraction approaches and implementation

**[7. Pipeline Model Options](./7-pipeline-model-options.md)** - Claude model selection and optimization

### Design System

**[8. Design Scheme](./8-design-scheme.md)** - UI/UX design system and component guidelines

## Reading Guide

### For First-Time Readers
**Start here:**
1. Read [0. Overview](./0-overview.md) to understand what the platform does
2. Skim [1. Frontend](./1-frontend.md) to see how the UI is organized
3. Skim [2. Backend](./2-backend.md) to understand the API architecture

**Then explore based on your role:**
- **Frontend Developers**: Deep dive into docs 1, 4, and 8
- **Backend Developers**: Deep dive into docs 2, 3, and 6
- **Product/Research**: Focus on docs 0, 4, 5, and 6

### For Specific Tasks
- **Understanding search functionality**: Read 0 (Data Flow) and 2 (AI Query Enhancement)
- **Working with drug data**: Read 5 (Drug Matching) and 1 (Drug Grouping Service)
- **Database changes**: Read 3 (Database) - note the project-centric design
- **AI/LLM optimization**: Read 6 (LLM Strategy) and 7 (Model Options)
- **UI components**: Read 8 (Design Scheme) and 1 (Components)

## Key Concepts

- **Discovery-Focused Search**: Uses phrase-based strategies instead of drug names to find emerging candidates
- **Two-Stage AI Processing**: Claude for intent, Gemini for query enhancement and drug extraction
- **Drug-Centric Analysis**: Automatically groups trials and papers by drug compound
- **Project-Centric Database**: All data organized around research projects (work in progress)
- **Client-Side Services**: Business logic lives in frontend services, not backend APIs

## Documentation Standards

All documentation follows these conventions:
- Updated date at the top of each file
- No emojis (uses clear text instead)
- Code examples with file paths
- Practical implementation details over theory

---

**Last Updated**: October 26, 2025

