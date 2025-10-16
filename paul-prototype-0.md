# Prototype 0: Command Palette Interface

## Overview
**Prototype Name:** The "Failure" - Command Palette Interaction  
**Date:** October 16, 2025  
**Status:** Complete  

## Objective
Create a full-stack prototype of a "Market Landscape Generator" that uses a command-line interface. This prototype is designated as the **"failure"** because its keyboard-first interaction mode is powerful but not intuitive for the target user personas described in the PRD (like Hedwig or Alisha).

## Architecture

### Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite 5
- **Styling:** Plain CSS with minimal styling

### Backend Simulation
- **Mock Data:** In-memory data structure (`mock-data.ts`)
- **API Simulation:** Promise-based async functions with simulated network delay (`mock-api.ts`)

## Features Implemented

### 1. Command Palette Interface
- Single input field that accepts natural language commands
- Submit on "Enter" key press
- Examples of supported commands:
  - "phase 3" - filters trials by Phase 3
  - "novo nordisk" - filters trials by Novo Nordisk company
  - "phase 3 novo nordisk" - combines filters
  - "fail" - simulates API failure (returns empty results)

### 2. Data Model
```typescript
interface Trial {
  id: string;
  drug: string;
  company: string;
  phase: string;
  status: string;
}
```

### 3. Mock Data
5 clinical trials with various drugs, companies, phases, and statuses:
- Semaglutide (Novo Nordisk)
- Tirzepatide (Eli Lilly)
- Liraglutide (Novo Nordisk)
- Drug Candidate X (Pfizer)

### 4. API Simulation
- 500ms simulated network delay
- Command parsing using string matching
- Filter logic for phase and company
- Console logging for debugging

### 5. UI Components
- Centered layout with max-width container
- Command input field
- Loading state indicator
- Results display area
- Raw JSON output for each trial

## Design Decisions

### Why This is the "Failure"
1. **Requires command syntax knowledge:** Users need to know what commands are available
2. **No visual cues:** No suggestions, no autocomplete, no hints
3. **Text-only output:** Results are displayed as raw JSON strings
4. **No discoverability:** Users can't explore the data without knowing the commands
5. **Keyboard-only interaction:** No clickable elements or visual filters
6. **No error feedback:** Failed searches just show "No results found"

### Technical Choices
- **Plain CSS:** Intentionally minimal styling to emphasize the lack of visual design
- **Unstyled lists:** Raw `<ul>` and `<li>` elements to show the data without polish
- **JSON.stringify():** Direct output of data objects to simulate a developer-first interface
- **Simple string matching:** Basic `.includes()` logic instead of sophisticated parsing

## User Experience Issues

### For Hedwig (Finance professional, 35-45)
- ❌ No visual dashboard or charts
- ❌ Requires remembering command syntax
- ❌ Can't quickly scan or compare data
- ❌ No way to save or export views

### For Alisha (Product manager, 28-35)
- ❌ No intuitive exploration
- ❌ Can't discover available filters
- ❌ No visual feedback or guidance
- ❌ Difficult to share findings with team

## Lessons for Next Prototypes
1. Need visual filters and controls
2. Require data visualization (charts, graphs)
3. Must provide discoverability mechanisms
4. Should show available options and suggestions
5. Need better formatting and presentation of results

## Running the Prototype

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## File Structure
```
/
├── src/
│   ├── mock-data.ts       # Trial interface and mock data
│   ├── mock-api.ts        # Simulated API with filtering logic
│   ├── App.tsx            # Main component with command palette
│   ├── App.css            # Minimal styling
│   ├── main.tsx           # React entry point
│   └── index.css          # Global styles
├── index.html             # HTML template
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── vite.config.ts         # Vite configuration
```

## Commands to Try

### Basic Queries
- `phase 3` - Show all Phase 3 trials
- `novo nordisk` - Show all Novo Nordisk trials
- `phase 3 novo nordisk` - Combine both filters

### Edge Cases
- `fail` - Simulate API failure
- `phase 1` - Show Phase 1 trials
- `pfizer` - Show Pfizer trials
- (empty) - Shows all trials

## Next Steps
Future prototypes should focus on:
1. Visual, GUI-based interactions
2. Data visualization and charts
3. Drag-and-drop or point-and-click filters
4. Better data presentation
5. User guidance and onboarding

