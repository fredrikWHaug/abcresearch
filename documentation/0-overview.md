LATEST UPDATE: 10/26/25

# ABCresearch - Application Overview

## Executive Summary

ABCresearch is an AI-powered research assistant platform designed specifically for biotech equity researchers. The application provides comprehensive data collection, analysis, and visualization of clinical trials and academic papers, enabling researchers to make informed investment decisions in the biotech sector.

## Core Purpose

The platform serves as a centralized hub for:
- **Clinical Trials Discovery**: Search and analyze clinical trials from ClinicalTrials.gov
- **Research Papers Analysis**: Find and link academic papers from PubMed to clinical trials
- **Drug Intelligence**: Automatically extract and group research by drug compounds
- **Market Mapping**: Visualize competitive landscapes and trial rankings
- **Asset Pipeline**: Table view of drug candidates across development stages
- **Data Extraction**: Extract structured data from PDF documents

## Key Features

### 1. Discovery-Focused AI Search
- **Phrase-based discovery**: AI generates 5 conceptual search strategies (e.g., "GLP-1 receptor agonist diabetes") to uncover drugs across all development stages
- Natural language query processing powered by Claude (Anthropic) and Gemini (Google)
- Intent classification for intelligent search suggestions
- **88% cost reduction** and **2.5x faster** than previous drug-specific approach
- Discovers **175% more drugs** including emerging pipeline candidates

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
- AI-powered drug name extraction from trials and papers (using Gemini)
- Drug synonym recognition and normalization (e.g., Ozempic → Semaglutide)
- Automatic grouping of all research by drug compound
- Pattern matching for drug classes (monoclonal antibodies, kinase inhibitors, peptides)

### 5. Asset Development Pipeline
- Comprehensive table view of drug candidates by development stage
- Automatic classification: Marketed, Phase III, Phase II, Phase I, Pre-Clinical, Discovery
- Technology identification: Biologics, Small Molecule, Gene Therapy, Cell Therapy
- Filterable by stage, sponsor, indication, and drug name
- Sortable columns with summary statistics

### 6. Market Map Visualization
- Visual representation of competitive landscapes
- Trial rankings with multi-factor scoring explanations
- AI-powered slide generation for presentations
- Save and restore research sessions with full context

### 7. Data Extraction
- PDF table extraction and conversion to Excel
- Supabase Edge Function processing for scalability
- Structured data output for analysis

### 8. Authentication & Data Persistence
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
   - AI generates 5 phrase-based discovery queries
   - System performs parallel searches across:
     - ClinicalTrials.gov (5 discovery strategies, 50 results each)
     - PubMed (5 discovery strategies, 30 results each)
   - Results are deduplicated (~150 unique trials, ~80 unique papers)
   - All searches complete in 6-8 seconds

3. **Drug Analysis**
   - AI extracts drug names from unified result set (20 trials + 20 papers analyzed)
   - Discovers 20-25 unique drugs including emerging pipeline candidates
   - Grouping by drug compound with synonym normalization
   - Local grouping of all results by extracted drugs (no additional searches)

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
User Query (e.g., "GLP-1 receptor agonists")
    ↓
AI Intent Classification (Claude)
    ↓
AI Query Enhancement (Gemini) → 5 phrase-based discovery strategies
    ↓
Parallel Searches
    ├─ ClinicalTrials.gov (5 strategies × 50 results)
    └─ PubMed (5 strategies × 30 results)
    ↓
Deduplication (~250 trials → ~150 unique, ~150 papers → ~80 unique)
    ↓
AI Drug Extraction (Gemini) → Extract 20-25 unique drugs
    ↓
Local Grouping → Map all trials/papers to extracted drugs
    ↓
Display Results (Drug-Centric Research View)
    ↓
Market Map / Asset Pipeline / Save Session (Optional)
```

## Key Differentiators

1. **Discovery-Focused Search**: Phrase-based AI search strategy that discovers emerging drugs missed by traditional drug-specific searches. Finds 175% more drugs while reducing costs by 88%

2. **AI-First Approach**: Every user query is processed through multiple AI models (Claude for chat, Gemini for search enhancement and drug extraction)

3. **Multi-Source Integration**: Combines clinical trials, academic papers, and drug intelligence in one unified platform

4. **Drug-Centric View**: Unique perspective automatically grouping all research by drug compound with synonym normalization

5. **Smart Ranking**: Multi-factor ranking algorithm considering phase, enrollment, recency, and trial status

6. **Session Persistence**: Full context saving including chat history, search results, papers, and AI-generated analysis

7. **Guest Mode**: Try before authentication for seamless onboarding

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

- **Search Speed**: 6-8 seconds for complete discovery search (10 parallel API calls)
- **Cost Efficiency**: ~$0.30 per search (88% reduction from previous architecture)
- **API Efficiency**: 10 API calls per search vs. 84 calls in previous implementation
- **Coverage**: Discovers 20-25 drugs per search with 150+ trials and 80+ papers
- **Rate Limiting**: Intelligent rate limiting to respect external API constraints (PubMed: 350ms between calls)
- **Deduplication**: Automatic deduplication by NCT ID (trials) and PMID (papers)
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

