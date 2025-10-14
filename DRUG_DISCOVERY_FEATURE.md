# Drug Discovery Conversational Search Feature

## Overview
This feature implements a conversational AI-driven drug discovery search where users engage in a dialogue with an AI assistant to narrow down specific drugs before conducting research searches.

## How It Works

### 1. User Starts a Conversation
- Users describe the type of therapeutic they're looking for (e.g., "checkpoint inhibitors for melanoma")
- The AI assistant asks clarifying questions to narrow down the search

### 2. Conversation Flow
- The AI progressively narrows down the search by asking about:
  - Therapeutic area (oncology, cardiology, etc.)
  - Drug class/mechanism of action
  - Specific targets or pathways
  - Development stage
  - Administration route
  - Specific companies or sponsors

### 3. Search Execution
- Once the AI identifies 3-20 specific drugs, it automatically triggers a search
- Clinical trials are searched for all identified drugs
- Results are displayed in a full-screen modal

### 4. Results Display
The results modal shows:
- **Left Side**: List of identified drugs
  - Click on any drug to expand and see related research papers
  - Papers are fetched on-demand when a drug is clicked
- **Right Side**: All clinical trials related to the search
  - Full trial details including NCT ID, status, phase, sponsors, and interventions

## Components Created

### 1. `ConversationalSearch.tsx`
Main component for the drug discovery chat interface
- Handles conversation with AI
- Manages search execution
- Displays chat history
- Opens results modal

### 2. `SearchResultsModal.tsx`
Full-screen modal showing search results
- Side-by-side drug and trial display
- Expandable drug entries showing related papers
- Interactive UI with smooth animations

### 3. `dialog.tsx`
Custom dialog/modal component (no external dependencies)
- Handles modal display
- ESC key support
- Click-outside-to-close functionality

## Services Created

### 1. `drugDiscoveryAPI.ts`
Frontend service for drug discovery conversations
- Interfaces with the API endpoint
- Manages conversation state
- TypeScript types for all data structures

## API Endpoints

### `/api/drug-conversation.ts`
Handles the conversational AI logic
- Uses Claude 3.5 Sonnet for intelligent conversations
- Progressively narrows down drug selection
- Returns structured responses with:
  - Assistant messages
  - Whether search is ready
  - Final list of drugs
  - Clarification questions

## Integration

The feature is integrated into the Dashboard as a new view mode:
- **Drug Discovery** tab in the main navigation
- Accessible from the top navigation bar
- Independent of other search modes

## User Flow Example

1. User clicks "Drug Discovery" tab
2. User enters: "I'm looking for EGFR inhibitors"
3. AI responds: "Great! Are you interested in EGFR inhibitors for lung cancer, colorectal cancer, or another indication?"
4. User: "Lung cancer"
5. AI: "Perfect! Would you like to focus on first-generation EGFR inhibitors (like gefitinib, erlotinib), second-generation (afatinib, dacomitinib), or third-generation (osimertinib)?"
6. User: "Third-generation"
7. AI: "I've identified these drugs: Osimertinib, Lazertinib, Rociletinib. I'm now searching for clinical trials..."
8. **Search executes automatically**
9. Full-screen modal appears with:
   - Left: The 3 drugs (clickable to see papers)
   - Right: All related clinical trials

## Technical Details

- **AI Model**: Claude 3.5 Sonnet (via Anthropic API)
- **Search Integration**: Uses existing `EnhancedSearchAPI` for trial searches
- **Paper Fetching**: Uses existing `pubmedAPI` for on-demand paper retrieval
- **State Management**: React hooks for local component state
- **No Additional Dependencies**: Custom dialog component, no new npm packages needed

## Benefits

1. **Precision**: Users get exactly the drugs they're looking for
2. **Efficiency**: No wasted searches on broad queries
3. **Educational**: Users learn about drug categories through conversation
4. **Comprehensive**: Shows both trials and papers in one view
5. **Interactive**: Click-to-expand drug papers for detailed exploration

