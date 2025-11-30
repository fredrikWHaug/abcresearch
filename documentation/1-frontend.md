LATEST UPDATE: 11/30/25

# ABCresearch - Frontend Documentation

## Architecture Overview

The frontend is a single-page application (SPA) built with React 19, TypeScript, and Vite. It follows a component-based architecture with centralized state management using React Context and hooks.

## Technology Stack

### Core Framework
- **React**: 19.1.1 (Latest)
- **TypeScript**: 5.8.3
- **Vite**: 7.1.7 (Build tool and dev server)

### UI Libraries
- **TailwindCSS**: 4.1.13 (Utility-first CSS)
- **Radix UI**: Accessible component primitives
- **Lucide React**: Icon library
- **Recharts**: Data visualization

### Form Management
- **React Hook Form**: 7.63.0
- **Zod**: 4.1.11 (Schema validation)
- **@hookform/resolvers**: Form validation integration

### Additional Libraries
- **PDF.js**: 5.4.149 (PDF processing)
- **XLSX**: 0.18.5 (Excel generation)
- **class-variance-authority**: Component variant styling
- **tailwind-merge**: Utility class merging

## Project Structure

```
src/
├── components/          # React components
│   ├── auth/           # Authentication components
│   ├── dashboard/      # Dashboard feature components
│   │   └── views/      # Modular dashboard views (8 components)
│   ├── ui/             # Reusable UI components
│   └── [features]      # Feature-specific components
├── contexts/           # React Context providers
├── services/           # Business logic services
├── types/              # TypeScript type definitions
├── lib/                # Utility functions
├── App.tsx             # Root application component
├── main.tsx            # Application entry point
└── index.css           # Global styles
```

## Component Architecture

### 1. Application Entry Point

**File**: `src/main.tsx`
```typescript
// Renders root React app into DOM
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

**File**: `src/App.tsx`
- Root component managing authentication state
- Renders AuthForm, EntryChoice, or Dashboard based on auth state
- Wraps application in AuthProvider context

### 2. Authentication Flow

**Component**: `AuthForm` (`src/components/auth/AuthForm.tsx`)
- Handles sign-in and sign-up
- Guest mode entry
- Form validation with Zod schemas

**Component**: `EntryChoice` (`src/components/EntryChoice.tsx`)
- Post-authentication choice screen
- Options: Start new project or open saved map

**Context**: `AuthContext` (`src/contexts/AuthContext.tsx`)
- Manages user authentication state
- Supabase Auth integration
- Guest mode management
- Methods: `signIn`, `signUp`, `signOut`, `enterGuestMode`, `exitGuestMode`

### 3. Main Dashboard

**Component**: `Dashboard` (`src/components/Dashboard.tsx`)

**State Management**:
```typescript
// Search & Results
const [message, setMessage] = useState('')
const [trials, setTrials] = useState<ClinicalTrial[]>([])
const [papers, setPapers] = useState<PubMedArticle[]>([])
const [drugGroups, setDrugGroups] = useState<DrugGroup[]>([])

// UI State
const [viewMode, setViewMode] = useState<'research' | 'marketmap' | 'savedmaps' | 'dataextraction' | 'pipeline'>()
const [researchTab, setResearchTab] = useState<'trials' | 'papers'>('papers')

// Slide Generation
const [slideData, setSlideData] = useState<SlideData | null>(null)
const [generatingSlide, setGeneratingSlide] = useState(false)

// Project Management
const [currentProjectId, setCurrentProjectId] = useState<number | null>(null)
const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
```

**View Modes**:
1. **Initial State**: Centered search bar
2. **Research Mode**: Split-screen chat + drug-centric results
3. **Market Map Mode**: Full-screen trial visualization
4. **Asset Pipeline Mode**: Table view of drug candidates by development stage
5. **Saved Maps Mode**: Saved projects gallery
6. **Data Extraction Mode**: PDF upload and processing

**Key Features**:
- Real-time AI chat interface
- Search suggestion handling
- Project saving and restoration
- PDF processing workflow

**Modular Architecture (Nov 2025 Refactor)**:

The Dashboard has been refactored into modular view components for better maintainability and separation of concerns. All view components are located in `src/components/dashboard/views/`:

### 3a. Dashboard View Components

The Dashboard delegates rendering to specialized view components based on the current state:

#### InitialResearchView
**File**: `src/components/dashboard/views/InitialResearchView.tsx` (244 lines)

The initial landing state when no search has been performed yet.

**Features**:
- Centered search interface with AI-powered suggestions
- Recent project sidebar with quick access
- Welcome message and search tips
- Seamless transition to research view after first search

**Props**:
- `message`, `setMessage` - Current search query
- `handleSearch` - Search submission handler
- `loading` - Loading state indicator
- `userProjects` - List of user's recent projects
- `onProjectSelect` - Project selection handler

#### ResearchSplitView
**File**: `src/components/dashboard/views/ResearchSplitView.tsx` (443 lines)

The main research interface with split-screen layout (chat + results).

**Layout**:
- **Left Panel** (40%): Chat interface with conversation history
- **Right Panel** (60%): Drug-centric research results

**Features**:
- Real-time AI chat with search suggestions
- Drug discovery search results grouped by compound
- Tabbed interface for Trials/Papers views
- Context panel for selected papers
- Deep dive search for individual drugs
- Project management (save, load, switch)

**Props**:
- All Dashboard state (trials, papers, drugGroups, chatHistory)
- Search and UI handlers
- Project management functions

#### ResearchChatView
**File**: `src/components/dashboard/views/ResearchChatView.tsx` (346 lines)

Standalone full-width chat interface for focused conversation.

**Features**:
- Full-screen chat experience
- AI-powered search suggestions in conversation flow
- Chat history persistence per project
- Seamless switching between chat and data views

**Props**:
- `chatHistory`, `setChatHistory`
- `message`, `setMessage`
- `handleSearch`
- `loading`

#### MarketMapCombinedView
**File**: `src/components/dashboard/views/MarketMapCombinedView.tsx` (85 lines)

Market map visualization with competitive landscape analysis.

**Features**:
- Visual trial rankings with multi-factor scoring
- AI-generated slide content
- Save market map functionality
- Export capabilities

**Props**:
- `trials` - Clinical trials data
- `slideData` - AI-generated slide content
- `currentProjectId` - Active project
- Save handlers

#### PipelineView
**File**: `src/components/dashboard/views/PipelineView.tsx` (40 lines)

Asset development pipeline view wrapper.

**Features**:
- Delegates to `AssetDevelopmentPipeline` component
- Maintains pipeline state and filters
- Drug-stage classification and visualization

**Props**:
- `trials`, `papers`, `drugGroups`
- `lastQuery` - Last search query for context
- Paper context management handlers

#### DataExtractionView
**File**: `src/components/dashboard/views/DataExtractionView.tsx` (11 lines)

PDF extraction interface wrapper.

**Features**:
- PDF upload and processing
- Table extraction to Excel
- Delegates to `PDFExtraction` component

#### RealtimeFeedView
**File**: `src/components/dashboard/views/RealtimeFeedView.tsx` (11 lines)

RSS feed monitoring interface wrapper.

**Features**:
- Real-time trial update monitoring
- Feed subscription management
- Delegates to `RealtimeFeed` component

#### View Types
**File**: `src/components/dashboard/views/types.ts` (7 lines)

Shared TypeScript types for view components.

```typescript
export type ViewMode = 
  | 'initial'
  | 'research' 
  | 'marketmap' 
  | 'savedmaps' 
  | 'dataextraction' 
  | 'pipeline'
  | 'realtimefeed'
```

**Benefits of Modular Architecture**:
- **Maintainability**: Each view is self-contained (~40-450 lines vs 2,200 line monolith)
- **Testability**: Views can be tested in isolation
- **Reusability**: Views can be composed in different layouts
- **Performance**: Only active view is rendered
- **Developer Experience**: Easier to locate and modify view-specific logic

### 4. Research View Components

#### DrugsList Component
**File**: `src/components/DrugsList.tsx`
- Grid display of drug groups
- Shows paper count, trial count, and total results per drug
- Click to drill into drug details

#### DrugDetail Component
**File**: `src/components/DrugDetail.tsx`
- Detailed view of a single drug
- Lists associated papers and trials
- Expandable paper cards with abstracts
- Back navigation and fullscreen toggle

#### DrugDetailModal Component
**File**: `src/components/DrugDetailModal.tsx`
- Fullscreen modal version of drug detail
- Enhanced viewing experience for detailed research

#### TrialsList Component
**File**: `src/components/TrialsList.tsx`
- List view of clinical trials
- Trial cards with metadata (phase, status, enrollment)
- Sponsor and location information
- NCT ID linking to ClinicalTrials.gov

#### PapersDiscovery Component
**File**: `src/components/PapersDiscovery.tsx`
- List view of research papers
- Paper cards with title, abstract, journal
- PMID linking to PubMed
- Author and publication date display

### 5. Market Map Components

#### MarketMap Component
**File**: `src/components/MarketMap.tsx`

**Features**:
- Full-screen trial visualization
- Ranked trial display with scoring
- Market map generation button
- Save dialog for project persistence

**State**:
```typescript
const [showSaveDialog, setShowSaveDialog] = useState(false)
const [saveName, setSaveName] = useState('')
const [saving, setSaving] = useState(false)
```

**Key Functions**:
- `handleGenerateSlide()`: Triggers AI-powered slide generation
- `handleSaveMarketMap()`: Saves project to database
- `handleCloseSlide()`: Closes slide modal

#### Slide Component
**File**: `src/components/Slide.tsx`
- Modal displaying generated market analysis
- AI-generated insights and visualizations
- Save functionality
- Close button

### 6. Saved Maps Components

#### SavedMaps Component
**File**: `src/components/SavedMaps.tsx`

**Features**:
- Grid display of saved projects
- Project cards with preview information
- Load and delete actions
- Timestamps and query display

**Props**:
```typescript
interface SavedMapsProps {
  onLoadMap: (savedMap: SavedMarketMap) => void
  onDeleteMap: (id: number) => void
}
```

### 7. Data Extraction Components

**Implementation**: Integrated in Dashboard component

**Features**:
- File upload interface
- PDF processing status
- Success/error messaging
- Excel download button

**State**:
```typescript
const [isProcessingPDF, setIsProcessingPDF] = useState(false)
const [pdfProcessingResult, setPdfProcessingResult] = useState<ExtractionResult | null>(null)
const [selectedFile, setSelectedFile] = useState<File | null>(null)
```

### 8. Asset Pipeline Component

#### AssetDevelopmentPipeline Component
**File**: `src/components/AssetDevelopmentPipeline.tsx`

**Features**:
- Comprehensive table view of drug candidates
- Automatic classification by development stage (Marketed, Phase III, Phase II, Phase I, Pre-Clinical, Discovery)
- Technology type identification (Biologics, Small Molecule, Gene Therapy, Cell Therapy)
- Filterable by stage, sponsor, indication, and drug name
- Sortable columns with summary statistics

**Props**:
```typescript
interface AssetPipelineProps {
  trials: ClinicalTrial[]
  drugGroups: DrugGroup[]
  query: string
  onAddPaperToContext: (paper: PubMedArticle) => void
  isPaperInContext: (pmid: string) => boolean
}
```

### 9. Reusable UI Components

Located in `src/components/ui/`:

#### Button
**File**: `button.tsx`
- **Style**: Pill-shaped (`rounded-full`)
- **Variants**: default, destructive, outline, secondary, ghost, link, **glass**
- **Animations**: `hover:scale-105`, `active:scale-95`, shadow transitions
- Built with Radix UI Slot for composition

#### Card
**File**: `card.tsx`
- **Style**: `rounded-2xl`, `border-black/5`
- **Components**: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- **Interaction**: Subtle hover lift and shadow deepening

#### Input
**File**: `input.tsx`
- **Style**: `rounded-xl` or `rounded-full`, `bg-background/50`
- **Focus**: Soft ring with alpha transparency
- Consistent with design system

#### Badge
**File**: `badge.tsx`
- **Style**: `rounded-full`, `backdrop-blur-sm` support
- **Variants**: default, secondary, destructive, outline
- Used for tags and labels

#### Form Components
**Files**: `form.tsx`, `label.tsx`
- React Hook Form integration
- Accessible form field components
- Error message display

## Service Layer (Client-Side)

All business logic is encapsulated in service classes:

### 1. GatherSearchResultsService
**File**: `src/services/gatherSearchResults.ts`

**Purpose**: Orchestrates all search operations using discovery-focused strategy

**Core Philosophy**: 

**DON'T** search for specific drug names (misses new discoveries)  
**DO** search by therapeutic phrases/concepts, then EXTRACT all drug names from results

**Why This Approach?**

The old drug-specific search approach had critical flaws:
```
1. Search "GLP-1" → Find 60 trials
2. Extract drug names: ["semaglutide", "tirzepatide", ...]
3. For each drug, search again: "semaglutide GLP-1" → 15 trials
   ❌ Only finds drugs in initial 60 trials
   ❌ Misses emerging drugs with different terminology
   ❌ Misses drugs with low publication counts
   ❌ Expensive (10+ additional searches per query)
```

**New Discovery Approach**:
```
1. LLM generates 5 phrase-based queries:
   - "GLP-1 receptor agonist diabetes" (primary mechanism)
   - "incretin mimetic obesity" (alternative term)
   - "glucagon-like peptide cardiovascular" (full name)
   - "Phase 3 GLP-1 weight loss" (late-stage trials)
   - "novel GLP-1 oral formulation" (emerging delivery)

2. Execute all 5 in parallel → Union → 150 unique trials

3. Extract ALL drug names from 150 trials ✅ DISCOVERS EVERYTHING

4. Group 150 trials by extracted drug names (no additional searches)
```

**Advantages**:
- ✅ Finds 175% more drugs than drug-specific approach
- ✅ Discovers drugs across all stages (discovery → approved)
- ✅ Captures emerging drugs with limited publications
- ✅ 88% cost reduction (one search vs 10+)
- ✅ Faster execution (6-8 seconds for complete search)

**Methods**:
```typescript
static async gatherSearchResults(userQuery: string): Promise<GatherSearchResultsResponse>
static async simpleSearch(userQuery: string): Promise<GatherSearchResultsResponse>
private static async enhanceQuery(userQuery: string): Promise<EnhancedQueries>
private static async searchClinicalTrials(userQuery: string): Promise<{trials, searchStrategies}>
private static async searchResearchPapers(userQuery: string): Promise<PubMedArticle[]>
```

**Search Flow**:
1. AI-enhanced query generation (5 phrase-based discovery strategies via Gemini)
   - Focus on therapeutic mechanisms, not drug names
   - Alternative terminology, disease + mechanism combos
   - Development stage filters, broad discovery patterns
2. Parallel trial searches across all strategies (5 × 50 results = 250 total)
3. Parallel PubMed paper searches (5 × 30 results = 150 total)
4. Result deduplication (~250 trials → ~150 unique, ~150 papers → ~80 unique)
5. AI drug extraction from unified results (Gemini analyzes top 20 trials + 20 papers)
6. Local grouping of all results by extracted drugs (no additional API calls)
7. Return combined results with 20-25 discovered drugs

**Performance**: Complete search in 6-8 seconds (10 parallel API calls)

### 2. ExtractDrugNamesService
**File**: `src/services/extractDrugNames.ts`

**Purpose**: AI-powered drug name extraction from trials and papers

**Methods**:
```typescript
static async extractFromSearchResults(
  trials: ClinicalTrial[], 
  papers: PubMedArticle[], 
  userQuery: string
): Promise<{ uniqueDrugNames: string[], drugInfo: DrugInfo[] }>

static async extractFromTrials(trials: ClinicalTrial[], userQuery: string): Promise<string[]>
static async extractFromPapers(papers: PubMedArticle[], userQuery: string): Promise<string[]>
```

**Extraction Process**:
- Uses Gemini API to intelligently extract drug names
- Analyzes 20 trials and 20 papers from search results
- Filters out generic terms (placebo, standard care, chemotherapy)
- Returns 20-25 unique drug names with confidence scores
- Context-aware extraction using original user query

**Drug Blacklist**:
- Filters out: placebo, control, standard care, therapy, treatment
- Removes generic drug classes: insulin, metformin, aspirin
- Excludes non-drugs: surgery, radiation, chemotherapy

### 3. DrugGroupingService
**File**: `src/services/drugGroupingService.ts`

**Purpose**: Groups papers and trials by drug compounds (after AI extraction)

**Methods**:
```typescript
static groupByDrugs(papers: PubMedArticle[], trials: ClinicalTrial[]): DrugGroup[]
static filterDrugGroups(groups: DrugGroup[], query: string): DrugGroup[]
private static normalizeDrugName(drugName: string): string
```

**Note**: Pattern-based extraction is deprecated. This service now primarily handles grouping of drugs after AI extraction by ExtractDrugNamesService.

### 4. TrialRankingService
**File**: `src/services/trialRankingService.ts`

**Purpose**: Ranks clinical trials by relevance

**Ranking Factors**:
```typescript
// Phase scoring
Phase 3: +30 points
Phase 2: +20 points
Phase 1: +10 points

// Status scoring
Recruiting: +25 points
Active, not recruiting: +15 points
Completed: +10 points

// Enrollment scoring
>1000 participants: +20 points
500-1000: +15 points
100-500: +10 points

// Recency scoring
<1 year: +20 points
1-2 years: +15 points
2-3 years: +10 points
```

### 5. MarketMapService
**File**: `src/services/marketMapService.ts`

**Purpose**: Database operations for saved projects

**Methods**:
```typescript
static async saveMarketMap(data: CreateMarketMapData): Promise<SavedMarketMap>
static async getUserMarketMaps(): Promise<SavedMarketMap[]>
static async getMarketMap(id: number): Promise<SavedMarketMap>
static async updateMarketMap(id: number, data: Partial<CreateMarketMapData>): Promise<SavedMarketMap>
static async deleteMarketMap(id: number): Promise<void>
```

**Stored Data**:
- Project name and search query
- Trials data (full clinical trial objects)
- Slide data (generated market analysis)
- Chat history (conversational context)
- Papers data (linked research papers)

### 5a. DrugAssociationService
**File**: `src/services/drugAssociationService.ts` (809 lines)

**Purpose**: Manages drug-entity associations using proper database relationships (Nov 2025 refactor)

**Architecture**: Replaces text-based matching with junction tables for reliable, persistent drug-entity associations across trials, papers, press releases, and IR decks.

**Key Methods**:

```typescript
// Save drug groups to database with associations
static async saveDrugGroups(
  drugGroups: DrugGroup[], 
  projectId: number
): Promise<void>

// Load drug groups from database with associations
static async loadDrugGroups(projectId: number): Promise<DrugGroup[]>

// Junction table operations
static async linkDrugToTrial(drugId: number, trialId: number, projectId: number): Promise<void>
static async linkDrugToPaper(drugId: number, paperId: number, projectId: number): Promise<void>
static async linkDrugToPressRelease(drugId: number, prId: number, projectId: number): Promise<void>
static async linkDrugToIRDeck(drugId: number, deckId: number, projectId: number): Promise<void>

// Batch operations for efficiency
static async batchLinkDrugToTrials(drugId: number, trialIds: number[], projectId: number): Promise<void>
static async batchLinkDrugToPapers(drugId: number, paperIds: number[], projectId: number): Promise<void>

// Entity retrieval
static async getDrugTrials(drugId: number, projectId: number): Promise<ClinicalTrial[]>
static async getDrugPapers(drugId: number, projectId: number): Promise<PubMedArticle[]>
```

**Data Flow - Saving**:
1. Upsert drug → get `drug_id`
2. Link drug to project via `project_drugs`
3. Upsert each entity (trial/paper/press release/IR deck) → get entity IDs
4. Batch create associations in junction tables (`drug_trials`, `drug_papers`, etc.)
5. All associations include `project_id` for multi-tenant support

**Data Flow - Loading**:
1. Get all drugs for project from `project_drugs`
2. For each drug:
   - Query junction tables for associated entity IDs
   - Fetch actual entities (trials, papers, etc.)
   - Reconstruct `DrugGroup` object with all associations
3. Sort by `totalResults` and return

**Benefits**:
- **Consistency**: Associations persist exactly as saved (no text matching variation)
- **Performance**: Direct database joins instead of text scanning
- **Extensibility**: Easy to add new entity types (already supports 4 types)
- **Cross-Project Analysis**: Can query "all drugs" or "all trials" across projects

**Database Tables Used**:
- `drugs`, `trials`, `papers`, `press_releases`, `ir_decks` (entity tables)
- `project_drugs` (drug-project junction)
- `drug_trials`, `drug_papers`, `drug_press_releases`, `drug_ir_decks` (association junctions)

### 7. PaperLinkingService
**File**: `src/services/paperLinkingService.ts`

**Purpose**: Links papers to clinical trials

**Methods**:
```typescript
static async findPapersForTrial(trial: ClinicalTrial): Promise<PaperTrialLink>
static async findPapersForTrials(trials: ClinicalTrial[]): Promise<PaperTrialLink[]>
static async searchPapersForQuery(query: string, trials: ClinicalTrial[]): Promise<{queryPapers, trialLinks}>
```

**Linking Strategies**:
1. **Direct NCT ID match**: Search PubMed for NCT numbers
2. **Drug-condition match**: Cross-reference interventions and conditions
3. **Sponsor search**: Find papers authored by trial sponsors

**Link Strength**:
- **Strong**: Direct NCT match or 2+ high-relevance papers
- **Moderate**: 1 high-relevance paper or premium journal publication
- **Weak**: Generic matches only

### 8. PubMedAPI Service
**File**: `src/services/pubmedAPI.ts`

**Purpose**: Client-side PubMed API wrapper

**Methods**:
```typescript
async searchPapers(params: PubMedSearchParams): Promise<PubMedArticle[]>
async findPapersForTrial(nctId: string): Promise<PubMedArticle[]>
async searchByDrugCondition(drug: string, condition: string): Promise<PubMedArticle[]>
```

### 9. SlideAPI Service
**File**: `src/services/slideAPI.ts`

**Purpose**: Slide generation via API

**Methods**:
```typescript
static async generateSlide(trials: ClinicalTrial[], query: string): Promise<SlideData>
```

### 10. PipelineService
**File**: `src/services/pipelineService.ts`

**Purpose**: Converts clinical trials to pipeline drug candidate data

**Methods**:
```typescript
static trialsToPipeline(trials: ClinicalTrial[]): PipelineDrugCandidate[]
static filterCandidates(
  candidates: PipelineDrugCandidate[], 
  filters: FilterOptions
): PipelineDrugCandidate[]
static getStats(candidates: PipelineDrugCandidate[]): PipelineStats
```

**Pipeline Stage Mapping**:
- **Marketed**: Approved status or completed Phase 4
- **Phase III**: Active Phase 3 trials
- **Phase II**: Active Phase 2 trials
- **Phase I**: Active Phase 1 trials
- **Pre-Clinical**: Early-stage trials
- **Discovery**: Default for unclear stages

**Technology Classification**:
- Detects: Biologics, Small Molecule, Gene Therapy, Cell Therapy, Peptide
- Pattern matching on intervention names and types

### 11. PDFExtractionService
**File**: `src/services/pdfExtractionService.ts`

**Purpose**: PDF table extraction and Excel conversion

**Methods**:
```typescript
static async extractTablesFromPDF(file: File): Promise<ExtractionResult>
static downloadExcelFile(blob: Blob, filename: string): void
```

## Type System

Centralized type definitions in `src/types/`:

### Clinical Trials Types
**File**: `src/types/trials.ts`

```typescript
interface ClinicalTrial {
  nctId: string
  briefTitle: string
  officialTitle?: string
  overallStatus: string
  phase?: string[]
  conditions?: string[]
  interventions?: string[]
  sponsors?: {
    lead?: string
    collaborators?: string[]
  }
  startDate?: string
  completionDate?: string
  enrollment?: number
  studyType?: string
  locations?: Location[]
  rankScore?: number
  rankReasons?: string[]
}

interface SearchParams {
  query?: string
  condition?: string
  sponsor?: string
  phase?: string
  status?: string
  pageSize?: number
  pageToken?: string
}
```

### Research Papers Types
**File**: `src/types/papers.ts`

```typescript
interface PubMedArticle {
  pmid: string
  title: string
  abstract: string
  journal: string
  publicationDate: string
  doi?: string
  authors: string[]
  nctNumber?: string
  relevanceScore: number
  fullTextLinks: {
    pubmed: string
    doi?: string
  }
}

interface PubMedSearchParams {
  query: string
  maxResults?: number
  startDate?: string
  endDate?: string
}
```

## State Management Patterns

### 1. Context-Based Global State

**AuthContext**: User authentication state
```typescript
const { user, isGuest, signIn, signOut } = useAuth()
```

### 2. Component-Local State

**Dashboard State**: Main application state
- Search results (trials, papers, drugs)
- UI state (view mode, loading states)
- Project management (current project ID, chat history)

### 3. Prop Drilling

Parent components pass state and handlers to children:
```typescript
<MarketMap
  trials={trials}
  loading={loading}
  query={lastQuery}
  slideData={slideData}
  setSlideData={setSlideData}
  onSaveSuccess={() => {...}}
/>
```

## API Communication

All API calls are made through fetch to Vercel serverless functions:

```typescript
// Example: Search clinical trials
const response = await fetch('/api/search-clinical-trials', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(params)
})
const data = await response.json()
```

**API Endpoints Used**:
- `/api/search-clinical-trials` - Clinical trials search
- `/api/search-papers` - PubMed search
- `/api/enhance-search` - AI query enhancement
- `/api/extract-drug-names` - Drug extraction
- `/api/generate-response` - AI chat responses
- `/api/generate-slide` - Market analysis generation

## Styling Approach

### TailwindCSS Utility-First & Design System

The application uses a sophisticated TailwindCSS configuration powered by CSS variables for dynamic theming and a modern "Glassmorphism" aesthetic.

**Core Styling Principles (Nov 2025 Redesign)**:
- **Glassmorphism**: Extensive use of `backdrop-blur` and semi-transparent backgrounds (`bg-white/70`, `bg-white/80`).
- **Soft Geometry**: Preference for `rounded-full` buttons/inputs and `rounded-2xl` cards.
- **Fluid Motion**: Custom animations for entry (fade-in, scale-in) and interaction.
- **HSL Color System**: All colors defined as HSL variables for easy theming (e.g., `--primary: 220 90% 56%`).

**Example Component Styling**:
```tsx
<div className="h-16 bg-white/80 backdrop-blur-xl border-b border-white/20 shadow-sm z-50 sticky top-0">
  <h1 className="text-2xl font-bold tracking-tight text-gray-900 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
    ABCresearch
  </h1>
  <Button className="rounded-full shadow-lg hover:shadow-xl transition-all duration-300">
    Action
  </Button>
</div>
```

### Design Tokens

**Colors (HSL Variables)**:
- **Primary**: `220 90% 56%` (Vivid Professional Blue)
- **Background**: `210 20% 98%` (Soft Off-White)
- **Foreground**: `220 15% 15%` (Soft Black)
- **Muted**: `210 20% 94%` (Light Gray)

**Utilities**:
- `.glass`: `background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(12px);`
- `.no-scrollbar`: Hides scrollbar while allowing scrolling

**Animations**:
- `animate-fade-in`: Smooth opacity and translate-y entry.
- `animate-scale-in`: Subtle zoom and opacity entry.
- `animate-slide-in-right`: Sidebar entry animation.

### Component Variants

Using `class-variance-authority`:
```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md",
  {
    variants: {
      variant: {
        default: "bg-gray-900 text-white",
        outline: "border border-gray-200 bg-white",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      }
    }
  }
)
```

## Performance Optimizations

### 1. Parallel API Calls
**Discovery Search Strategy**:
```typescript
// Execute 5 phrase-based strategies in parallel for trials
const strategyResults = await Promise.all(
  strategies.map(strategy => 
    searchTrials({ query: strategy.query, pageSize: 50 })
  )
)

// Execute 5 phrase-based strategies in parallel for papers
const paperSearches = await Promise.all(
  strategies.map(strategy => 
    searchPapers({ query: strategy.query, maxResults: 30 })
  )
)
```

**Result**: 10 parallel API calls complete in 6-8 seconds

### 2. Deduplication
- Trials deduplicated by NCT ID (~250 → ~150 unique, 27% overlap)
- Papers deduplicated by PMID (~150 → ~80 unique, 37% overlap)
- Drugs normalized by AI extraction (20-25 unique drugs)

### 3. Conditional Rendering
```typescript
{loading ? <Loader /> : <Results data={results} />}
```

### 4. Lazy Loading
Components loaded on-demand based on view mode

### 5. Rate Limiting
- PubMed: 350ms delay between requests (respects 3 req/sec limit)
- ClinicalTrials.gov: Sequential with intelligent delays
- AI APIs: Error handling with fallback strategies

### 6. Local Grouping
- After drug extraction, grouping happens locally (no additional API calls)
- Filters trials/papers by matching drug names in text
- Sorts by relevance and date without external requests

## Error Handling

### API Error Pattern
```typescript
try {
  const response = await fetch('/api/endpoint', {...})
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  const data = await response.json()
  return data
} catch (error) {
  console.error('Error:', error)
  // Show user-friendly error message
  setError(error instanceof Error ? error.message : 'Unknown error')
}
```

### User Feedback
- Loading spinners during async operations
- Error messages displayed in UI
- Success confirmations for save operations

## Development Workflow

### Local Development
```bash
npm run dev      # Start Vite dev server (http://localhost:5173)
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Build Output
- Production build in `dist/` directory
- Static assets optimized and minified
- TypeScript compiled to JavaScript

### Environment Variables
Required for API keys (create `.env` file):
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

## Browser Support

- Modern browsers with ES2020+ support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Accessibility

- Radix UI components for accessibility primitives
- Semantic HTML structure
- ARIA labels where appropriate
- Keyboard navigation support
- Focus management in modals

## Testing Considerations

### Key Areas for Testing
1. **Authentication Flow**: Sign in, sign up, guest mode
2. **Search Functionality**: Query processing, result display
3. **Drug Grouping**: Extraction accuracy, synonym matching
4. **Project Saving**: Data persistence, restoration
5. **PDF Processing**: Upload, extraction, download

### Testing Tools (Not Currently Implemented)
- Jest for unit testing
- React Testing Library for component testing
- Playwright for E2E testing

## Future Frontend Enhancements

1. **Performance**: React Query for data caching
2. **State Management**: Redux Toolkit for complex state
3. **Testing**: Comprehensive test suite
4. **Accessibility**: WCAG 2.1 AA compliance audit
5. **Internationalization**: Multi-language support
6. **Progressive Web App**: Offline capabilities
7. **Real-time Updates**: WebSocket integration for live data
8. **Advanced Visualizations**: D3.js for interactive charts

