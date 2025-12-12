LATEST UPDATE: 10/26/25

# ABCresearch - Asset Development Pipeline Documentation

## Overview

The Asset Development Pipeline is a new feature that provides a comprehensive table view of drug candidates across different development stages. This feature automatically extracts and organizes drug candidates from clinical trial data, making it easy to analyze the competitive landscape.

## Features

### 1. Automatic Data Processing
- Automatically converts clinical trial data into structured drug candidate information
- Extracts key details from trial records:
  - Drug names (commercial and scientific)
  - Sponsor companies
  - Development stage (Marketed, Phase III, Phase II, Phase I, Pre-Clinical, Discovery)
  - Technology type (Biologics, Small Molecule, Gene Therapy, etc.)
  - Mechanism of action
  - Indications
  - Last trial start date

### 2. Table View
Displays drug candidates in a clean, sortable table with columns:
- **Drug Candidate**: Shows commercial name with scientific name in parentheses, or just scientific name if not marketed
- **Sponsor Company**: Lead sponsor organization
- **Stage**: Development phase with color-coded badges
- **Technologies**: Type of molecule/therapy (Biologics, Small Molecule, etc.)
- **Mechanism of Action**: How the drug works (Monotherapy, Combination Therapy, etc.)
- **Indications**: Diseases/conditions targeted
- **Last Trial Date**: Most recent trial start date

### 3. Filtering & Search
- **Search bar**: Filter by drug name, company, or indication
- **Stage filters**: Quick filter by development stage
- **Show/hide filters**: Toggle filter panel for cleaner view

### 4. Summary Statistics
At the bottom of the page, view quick stats:
- Total candidates
- Count by stage (Marketed, Phase III, Phase II, Phase I)

## How to Use

### Method 1: Using Real Search Data
1. Navigate to the **Research** tab
2. Perform a search for a disease or drug class (e.g., "Alzheimer's disease treatments")
3. Wait for search results to populate
4. Click the **Asset Pipeline** tab
5. The table will automatically populate with drugs from your search results

### Method 2: Demo Data
- Click the **Asset Pipeline** tab directly
- Demo data will be shown with sample Alzheimer's drug candidates
- A blue info banner will indicate you're viewing demo data

## Data Sources

The pipeline data is derived from:
- **Clinical Trials**: Primary data source from ClinicalTrials.gov
- **Trial Metadata**: Sponsor information, phase, interventions, conditions
- **Intervention Details**: Drug names, mechanisms, technology types

## Pipeline Service

The feature uses the `PipelineService` class to:
1. Extract drug names from clinical trial interventions
2. Determine development stage from trial phase
3. Identify marketed drugs from trial completion status
4. Aggregate multiple trials for the same drug
5. Sort by stage and recency

### Stage Detection Logic
- **Marketed**: Trials with "approved" status or completed Phase 4
- **Phase III**: Active Phase 3 trials
- **Phase II**: Active Phase 2 trials
- **Phase I**: Active Phase 1 trials
- **Pre-Clinical**: Early-stage trials
- **Discovery**: Default for unclear stages

### Technology Classification
Automatically classifies drugs by detecting keywords:
- **Biologics**: Antibodies, monoclonal antibodies
- **Small Molecule**: Traditional small molecule drugs
- **Gene Therapy**: Gene or RNA-based therapies
- **Cell Therapy**: Cell-based treatments
- **Peptide**: Peptide-based drugs

## UI Design

The pipeline table follows the app's existing design system:
- Clean, professional table layout
- Color-coded stage badges (green=Marketed, blue=Phase III, yellow=Phase II)
- Responsive design with horizontal scrolling for narrow screens
- Consistent with existing Market Map and Research views

## Integration Points

The Asset Pipeline integrates with:
1. **Dashboard**: Added as a new tab alongside Research, Market Map, Saved Maps, Data Extraction
2. **Clinical Trials Data**: Uses the same trial data from search results
3. **Drug Grouping Service**: Compatible with existing drug extraction logic

## File Structure

```
src/
├── components/
│   └── AssetDevelopmentPipeline.tsx    # Main component
├── services/
│   └── pipelineService.ts              # Data processing logic
└── types/
    └── pipeline.ts                      # TypeScript types
```

## Future Enhancements

Potential improvements:
1. Export to Excel/CSV
2. Detailed drug view with click-through
3. Timeline visualization of stage progression
4. Company comparison charts
5. Geographic distribution maps
6. Direct integration with drug detail modal
7. Save pipeline views as custom reports

## API Reference

### PipelineService

#### `trialsToPipeline(trials: ClinicalTrial[]): PipelineDrugCandidate[]`
Converts clinical trials to pipeline drug candidates.

**Parameters:**
- `trials`: Array of clinical trial objects

**Returns:**
- Array of `PipelineDrugCandidate` objects sorted by stage and date

#### `filterCandidates(candidates, filters): PipelineDrugCandidate[]`
Filters candidates based on criteria.

**Parameters:**
- `candidates`: Array of candidates to filter
- `filters`: Object with optional filters (stage, company, indication, searchQuery)

**Returns:**
- Filtered array of candidates

#### `getStats(candidates): PipelineStats`
Calculates statistics for pipeline candidates.

**Parameters:**
- `candidates`: Array of candidates

**Returns:**
- Statistics object with counts by stage, company, and indication

## Types

### PipelineDrugCandidate
```typescript
interface PipelineDrugCandidate {
  id: string;
  commercialName?: string;
  scientificName: string;
  sponsorCompany: string;
  stage: PipelineStage;
  technologies?: string;
  mechanismOfAction?: string;
  indications?: string[];
  lastTrialStartDate?: string;
}
```

### PipelineStage
```typescript
type PipelineStage = 
  | 'Marketed'
  | 'Phase III'
  | 'Phase II'
  | 'Phase I'
  | 'Pre-Clinical'
  | 'Discovery';
```

## Notes

- The pipeline automatically updates when switching between search results
- Demo data is provided for exploration without performing a search
- All dates are formatted as "MMM YYYY" (e.g., "Jan 2023")
- Indications are shown as badges for easy scanning
- The table is fully responsive and scrollable

