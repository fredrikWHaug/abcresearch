# ABCresearch - Application Overview

## Executive Summary

ABCresearch is an AI-powered research assistant platform designed specifically for biotech equity researchers. The application provides comprehensive data collection, analysis, and visualization of clinical trials and academic papers, enabling researchers to make informed investment decisions in the biotech sector.

## Core Purpose

The platform serves as a centralized hub for:
- **Clinical Trials Discovery**: Search and analyze clinical trials from ClinicalTrials.gov
- **Research Papers Analysis**: Find and link academic papers from PubMed to clinical trials
- **Drug Intelligence**: Automatically group and analyze research by drug compounds
- **Market Mapping**: Visualize competitive landscapes and trial rankings
- **Data Extraction**: Extract structured data from PDF documents

## Key Features

### 1. AI-Enhanced Search
- Natural language query processing powered by Claude (Anthropic) and Gemini (Google)
- Intent classification for intelligent search suggestions
- Multi-strategy search combining primary, alternative, and broad queries
- Automatic query enhancement using AI to maximize result relevance

### 2. Clinical Trials Intelligence
- Real-time data from ClinicalTrials.gov
- Advanced filtering by phase, status, condition, and sponsor
- Smart trial ranking based on relevance, phase, enrollment, and date
- Comprehensive trial metadata including interventions, locations, and sponsors

### 3. Research Papers Discovery
- PubMed integration for academic literature
- Automatic paper-to-trial linking via NCT numbers
- Drug-condition cross-referencing
- Relevance scoring based on journal quality and publication date

### 4. Drug-Centric Analysis
- Automatic drug name extraction from trials and papers
- Drug synonym recognition (e.g., Ozempic → Semaglutide)
- Grouping of all research by drug compound
- Pattern matching for drug naming conventions (monoclonal antibodies, kinase inhibitors, peptides)

### 5. Market Map Visualization
- Visual representation of competitive landscapes
- Trial rankings with scoring explanations
- Comprehensive slide generation with AI-powered insights
- Save and restore research sessions

### 6. Data Extraction
- PDF table extraction and conversion to Excel
- Edge function processing for scalability
- Structured data output for analysis

### 7. Authentication & Data Persistence
- Supabase-powered authentication
- Guest mode for trial usage
- Project saving and restoration
- Multi-session support

## User Workflow

### Typical Research Session

1. **Query Input**
   - User enters natural language query (e.g., "GLP-1 agonists for diabetes")
   - AI classifies intent and suggests search strategies

2. **Data Gathering**
   - System performs parallel searches across:
     - ClinicalTrials.gov (3 search strategies)
     - PubMed (clinical trial publications)
   - Results are deduplicated and ranked

3. **Drug Analysis**
   - Automatic extraction of drug names from trials and papers
   - Grouping by drug compound with synonym normalization
   - Drug-centric view showing all related research

4. **Market Map Generation**
   - AI-powered analysis of competitive landscape
   - Trial rankings with explanatory scoring
   - Slide generation for presentation

5. **Save & Share**
   - Save complete research sessions
   - Restore previous work with full context
   - Export data for further analysis

## Technical Architecture

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **UI Components**: Radix UI + TailwindCSS
- **State Management**: React Hooks (useState, useEffect, useContext)
- **Routing**: Single-page application with view mode switching

### Backend
- **API Proxies**: Vercel serverless functions
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **External APIs**:
  - ClinicalTrials.gov API v2
  - PubMed E-utilities API
  - Anthropic Claude API
  - Google Gemini API

### Architecture Pattern
```
┌─────────────┐
│   React UI  │
└──────┬──────┘
       │
┌──────▼──────────┐
│   Services      │ ← Business Logic
│  (Client-side)  │
└──────┬──────────┘
       │
┌──────▼──────────┐
│  API Proxies    │ ← Server-side (Vercel Functions)
│ (Server-side)   │
└──────┬──────────┘
       │
┌──────▼──────────┐
│  External APIs  │ ← ClinicalTrials.gov, PubMed, AI APIs
└─────────────────┘
```

## Data Flow

### Search Flow
```
User Query
    ↓
AI Intent Classification (Claude)
    ↓
Query Enhancement (Gemini)
    ↓
Parallel Searches (Clinical Trials + PubMed)
    ↓
Deduplication & Ranking
    ↓
Drug Extraction & Grouping
    ↓
Display Results (Research View)
    ↓
Market Map Generation (Optional)
    ↓
Save Session (Optional)
```

## Key Differentiators

1. **AI-First Approach**: Every user query is processed through AI for intent understanding and query optimization

2. **Multi-Source Integration**: Combines clinical trials, academic papers, and drug intelligence in one platform

3. **Drug-Centric View**: Unique perspective grouping all research by drug compound

4. **Smart Ranking**: Proprietary ranking algorithm considering multiple factors (phase, enrollment, recency, status)

5. **Session Persistence**: Full context saving including chat history, search results, and analysis

6. **Guest Mode**: Try before authentication for seamless onboarding

## Use Cases

### Biotech Equity Research
- Identify competitive landscapes for drug development
- Track clinical trial progress for portfolio companies
- Discover emerging therapeutic areas

### Competitive Intelligence
- Monitor competitor trial activity
- Analyze drug development pipelines
- Identify partnership opportunities

### Academic Research
- Literature review for clinical trials
- Drug mechanism research
- Therapeutic area exploration

## Technology Stack Summary

**Frontend**:
- React 19.1.1
- TypeScript 5.8.3
- Vite 7.1.7
- TailwindCSS 4.1.13
- Radix UI Components

**Backend**:
- Vercel Serverless Functions
- Supabase (PostgreSQL + Auth)
- Node.js runtime

**External APIs**:
- ClinicalTrials.gov API v2
- PubMed E-utilities
- Anthropic Claude API
- Google Gemini API

**Development Tools**:
- ESLint
- TypeScript Compiler
- PostCSS
- PDF.js for PDF processing

## Performance Characteristics

- **Search Speed**: Parallel API calls with typical response time of 2-5 seconds
- **Rate Limiting**: Intelligent rate limiting to respect external API constraints
- **Caching**: Result deduplication and local state management
- **Scalability**: Serverless architecture for automatic scaling

## Security Features

- JWT-based authentication via Supabase
- API key management through environment variables
- CORS-enabled API proxies
- Guest mode without data persistence
- Row-level security on database

## Future Roadmap

Based on the current architecture, potential enhancements:
- Real-time trial updates and notifications
- Advanced visualization (network graphs, timelines)
- PDF report generation
- Collaborative features (sharing, annotations)
- Enhanced AI analysis (success prediction, risk assessment)
- Integration with additional data sources (FDA databases, company filings)

