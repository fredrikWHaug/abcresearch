# Enhanced Search with Drug Grouping

This document describes the new enhanced search functionality that groups clinical trials and research papers by unique drug interventions.

## Overview

The enhanced search system provides:

1. **AI-Enhanced Query Processing**: Uses Gemini AI to construct optimized search queries for ClinicalTrials.gov and PubMed APIs
2. **Drug Extraction**: Automatically extracts drug interventions from clinical trials and papers using Gemini AI
3. **Intelligent Grouping**: Groups results by unique drug names with relevance scoring
4. **Interactive UI**: Displays results in collapsible dropdowns organized by drug names

## Architecture

### Services

#### 1. EnhanceUserQueryService (`src/services/enhanceUserQuery.ts`)
- Enhances user queries using AI to create optimized search strategies
- Generates separate queries for ClinicalTrials.gov and PubMed APIs
- Extracts conditions, interventions, and search terms

#### 2. SearchAndStoreService (`src/services/searchAndStoreService.ts`)
- Calls ClinicalTrials.gov and PubMed APIs in parallel
- Stores search results in Supabase database
- Handles deduplication and result merging

#### 3. ExtractDrugsService (`src/services/extractDrugsService.ts`)
- Uses Gemini AI to extract drug names from clinical trials and papers
- Processes interventions field from ClinicalTrials.gov
- Analyzes titles and abstracts from PubMed papers
- Normalizes drug names and handles variations

#### 4. GroupUniqueDrugsService (`src/services/groupUniqueDrugs.ts`)
- Groups trials and papers by unique drug names
- Calculates relevance scores based on user query
- Sorts results by match score
- Handles ungrouped results

#### 5. EnhancedSearchWithDrugsService (`src/services/enhancedSearchWithDrugs.ts`)
- Main service that orchestrates the entire enhanced search process
- Provides a single interface for the frontend
- Handles error recovery and fallback strategies

### Service Architecture

The enhanced search functionality is implemented as a service layer that orchestrates existing APIs:

#### Service Flow
1. **EnhanceUserQueryService** → Uses existing `/api/enhance-search` endpoint
2. **SearchAndStoreService** → Uses existing `EnhancedSearchAPI` and `pubmedAPI`
3. **ExtractDrugsService** → Uses Gemini AI directly for drug extraction
4. **GroupUniqueDrugsService** → Processes and groups results by drug names
5. **EnhancedSearchWithDrugsService** → Orchestrates the entire process

### UI Components

#### GroupedResults (`src/components/GroupedResults.tsx`)
- Displays search results grouped by drug names
- Collapsible dropdowns for each drug group
- Shows clinical trials and papers for each drug
- Includes relevance scores and confidence levels
- Supports item selection for export

## Database Schema

### search_sessions Table
```sql
CREATE TABLE search_sessions (
  id UUID PRIMARY KEY,
  user_query TEXT NOT NULL,
  enhanced_queries JSONB NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id)
);
```

## Usage

### Frontend Integration

The enhanced search is integrated into the Dashboard component:

1. **Search Suggestion Handling**: When users click on search suggestions, the system automatically uses enhanced search with drug grouping
2. **Fallback Strategy**: If drug grouping fails, the system falls back to regular enhanced search
3. **UI Tabs**: New "Drug Groups" tab shows the grouped results alongside existing "Research Papers" and "Clinical Trials" tabs

### Example Usage

```typescript
import { EnhancedSearchWithDrugsService } from '@/services/enhancedSearchWithDrugs';

const result = await EnhancedSearchWithDrugsService.searchWithDrugGrouping(
  'diabetes treatment metformin',
  userId
);

console.log(`Found ${result.groupedResults.totalDrugs} drug groups`);
```

## Configuration

### Environment Variables

Required environment variables:
- `GOOGLE_GEMINI_API_KEY`: For AI-powered query enhancement and drug extraction
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key
- `PUBMED_API_KEY`: (Optional) For enhanced PubMed API rate limits
- `PUBMED_EMAIL`: (Optional) For PubMed API compliance

### Supabase Setup

1. Run the SQL schema in `supabase_schema.sql` in your Supabase SQL editor
2. Ensure Row Level Security (RLS) is enabled
3. Configure authentication if needed

## Features

### Drug Grouping
- **Automatic Extraction**: Uses AI to identify drug interventions from clinical trials and papers
- **Normalization**: Handles drug name variations and standardizes naming
- **Confidence Scoring**: Provides confidence levels for extracted drugs
- **Source Tracking**: Tracks whether drugs were found in clinical trials or papers

### Relevance Scoring
- **Query Matching**: Scores based on how well results match the user's query
- **Quality Indicators**: Bonuses for premium journals, phase 3 trials, recent publications
- **Multi-factor Scoring**: Combines multiple factors for comprehensive relevance

### User Experience
- **Collapsible Interface**: Drug groups can be expanded/collapsed
- **Visual Indicators**: Color-coded relevance and confidence scores
- **Item Selection**: Users can select individual trials and papers
- **Export Ready**: Selected items can be exported (functionality to be implemented)

## Error Handling

The system includes comprehensive error handling:

1. **API Failures**: Graceful fallback to regular search if enhanced search fails
2. **Drug Extraction Errors**: Continues without drug grouping if extraction fails
3. **Rate Limiting**: Respects API rate limits with appropriate delays
4. **User Feedback**: Clear error messages and loading states

## Performance Considerations

- **Batch Processing**: Drugs are extracted in batches to respect API limits
- **Caching**: Search sessions are stored in Supabase for potential reuse
- **Parallel Processing**: Multiple search strategies run in parallel
- **Deduplication**: Results are deduplicated across search strategies

## Testing

The enhanced search functionality is now integrated into the Dashboard component and will be triggered automatically when users perform searches.

To test the functionality:

1. Start your development server: `npm run dev`
2. Open the application in your browser
3. Enter a search query like "diabetes treatment metformin"
4. Click on a search suggestion to trigger the enhanced search
5. Check the "Drug Groups" tab to see the grouped results

The service includes comprehensive error handling and will fall back to regular search if drug grouping fails.

## Future Enhancements

1. **Export Functionality**: Implement export to Excel, CSV, and JSON formats
2. **Advanced Filtering**: Add filters for drug types, trial phases, publication dates
3. **Drug Interactions**: Identify and highlight drug interaction studies
4. **Comparative Analysis**: Compare results across different drugs
5. **Saved Searches**: Allow users to save and revisit grouped search results
6. **Drug Database Integration**: Connect with drug databases for additional information

## Troubleshooting

### Common Issues

1. **No Drug Groups Found**: Check if the query contains drug-related terms
2. **API Rate Limits**: Ensure proper API key configuration and rate limiting
3. **Supabase Errors**: Verify database schema and RLS policies
4. **Gemini API Errors**: Check API key and quota limits

### Debug Information

The system provides comprehensive logging:
- Search query processing
- API call results
- Drug extraction progress
- Grouping statistics
- Error details with stack traces

Check browser console and server logs for detailed debugging information.
