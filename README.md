# ABCresearch

## Overview

ABCresearch is an AI-powered clinical trials research platform that enables biotech professionals to analyze and visualize clinical trial data from ClinicalTrials.gov. The platform combines natural language processing, intelligent search enhancement, and automated market analysis to provide actionable insights for pharmaceutical research and development.

## Features

- **AI-Powered Search**: Natural language processing for intuitive clinical trial searches
- **Enhanced Query Processing**: Multi-strategy search with AI-generated query variations
- **Intelligent Ranking**: Algorithm-based trial prioritization based on relevance, status, phase, and recency
- **Market Map Visualization**: Interactive visualization of clinical trial data with comprehensive analytics
- **AI-Generated Insights**: Automated slide generation with executive-level market analysis
- **Print-Ready Reports**: Professional PDF export functionality for presentations
- **Dual View Modes**: Research mode (split view) and Market Map mode (full screen)
- **Authentication System**: Supabase-based authentication with guest mode support
- **Real-time Data**: Direct integration with ClinicalTrials.gov API

## Technology Stack

### Frontend
- **React 18**: Modern React with hooks and functional components
- **TypeScript**: Type-safe development with comprehensive type definitions
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **shadcn/ui**: Modern component library with Radix UI primitives
- **Recharts**: Data visualization library for charts and graphs

### Backend
- **Vercel Serverless Functions**: Serverless API endpoints for AI processing
- **ClinicalTrials.gov API**: Official government API for clinical trial data
- **Supabase**: Authentication and database services

### AI Services
- **Google Gemini 2.0**: Query enhancement and natural language processing
- **Anthropic Claude 3 Haiku**: Slide generation and market analysis

### Development Tools
- **ESLint**: Code linting with TypeScript support
- **PostCSS**: CSS processing with Tailwind
- **Vercel**: Deployment and hosting platform

## Architecture

### API Integration Flow

The application follows a sophisticated multi-layered API integration pattern:

1. **User Query Processing**: Natural language queries are enhanced using Google Gemini 2.0
2. **Multi-Strategy Search**: Three parallel search strategies (primary, alternative, broad) are executed
3. **Data Aggregation**: Results are merged and deduplicated based on NCT IDs
4. **Intelligent Ranking**: Trials are scored and ranked using the TrialRankingService
5. **Visualization**: Results are displayed in either Research or Market Map view
6. **Slide Generation**: AI-powered market analysis slides are generated using Claude 3 Haiku

### Search Enhancement System

The EnhancedSearchAPI implements a three-tier search strategy:

- **Primary Strategy**: Most specific and targeted search based on user intent
- **Alternative Strategy**: Broader medical terms and synonyms for comprehensive coverage
- **Broad Strategy**: Wide search to capture related trials and edge cases

Each strategy uses different parameter combinations (condition, sponsor, phase, status) to maximize result coverage while maintaining relevance.

### Trial Ranking Algorithm

The TrialRankingService employs a weighted scoring system:

- **Title Relevance (40%)**: Keyword matching against trial titles
- **Status Score (30%)**: Prioritizes actively recruiting trials
- **Phase Score (20%)**: Favors advanced phase trials (Phase 3 > Phase 2 > Phase 1)
- **Recency Score (10%)**: Recent trials receive higher scores

Trials are ranked from 0-100% with detailed reasoning provided for each ranking decision.

### Print View System

The print functionality generates professional, print-ready HTML documents with:

- **Multi-page Layout**: Automatic page breaks for optimal printing
- **Chart Placeholders**: Static representations of dynamic charts for print compatibility
- **Executive Formatting**: Professional styling optimized for business presentations
- **Data Preservation**: All analytical data is preserved in print format
- **Branding**: Consistent ABCresearch branding and metadata

## Project Structure

```
src/
├── components/              # React components
│   ├── auth/
│   │   └── AuthForm.tsx    # Authentication interface
│   ├── ui/                 # Reusable UI components
│   ├── Dashboard.tsx       # Main application interface
│   ├── MarketMap.tsx       # Clinical trials visualization
│   ├── Slide.tsx          # Print-ready slide component
│   └── TrialsList.tsx     # Trial listing component
├── contexts/
│   └── AuthContext.tsx    # Authentication state management
├── lib/
│   ├── supabase.ts        # Supabase client configuration
│   └── utils.ts           # Utility functions
├── services/              # API and business logic
│   ├── clinicalTrialsAPI.ts      # ClinicalTrials.gov integration
│   ├── enhancedSearchAPI.ts      # AI-powered search enhancement
│   ├── slideAPI.ts               # Slide generation service
│   └── trialRankingService.ts    # Trial ranking algorithm
└── App.tsx                # Application root component

api/                       # Vercel serverless functions
├── enhance-search.ts     # Query enhancement endpoint
└── generate-slide.ts      # Slide generation endpoint
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Anthropic API key (optional)
- Google Gemini API key (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/fredrikWHaug/abcresearch
   cd abcresearch
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your-supabase-project-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ANTHROPIC_API_KEY=your-anthropic-api-key
   GOOGLE_GEMINI_API_KEY=your-google-gemini-api-key
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   Open your browser at `http://localhost:5173`

### Supabase Configuration

1. Create a new Supabase project
2. Navigate to Settings > API
3. Copy the Project URL and anon public key
4. Add `http://localhost:5173` to the allowed redirect URLs in Authentication settings

## Usage

### Basic Workflow

1. **Authentication**: Sign up, sign in, or use guest mode
2. **Search**: Enter natural language queries (e.g., "Phase 3 cancer trials by Pfizer")
3. **View Results**: Toggle between Research and Market Map views
4. **Generate Analysis**: Create AI-powered market analysis slides
5. **Export**: Print or save professional PDF reports

### Advanced Features

- **Guest Mode**: Test the platform without account creation
- **Multi-Strategy Search**: Automatic query enhancement for comprehensive results
- **Intelligent Ranking**: AI-powered trial prioritization
- **Professional Reports**: Executive-level market analysis slides
- **Print Optimization**: Print-ready formatting with charts and analytics

## API Endpoints

### `/api/enhance-search`
- **Method**: POST
- **Purpose**: Enhance user queries using Google Gemini 2.0
- **Input**: Natural language query
- **Output**: Three search strategies (primary, alternative, broad)

### `/api/generate-slide`
- **Method**: POST
- **Purpose**: Generate market analysis slides using Claude 3 Haiku
- **Input**: Clinical trials data and query
- **Output**: Structured slide data with charts and insights

## Development

### Code Quality

The project uses ESLint with TypeScript support for code quality:

```bash
npm run lint
```

### Build Process

```bash
npm run build
```

### Type Checking

```bash
npx tsc --noEmit
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Deployment

The application is deployed on Vercel with automatic deployments from the main branch. Environment variables are configured in the Vercel dashboard for production use.

## Performance Considerations

- **API Rate Limiting**: ClinicalTrials.gov API has rate limits that are respected
- **Caching**: Search results are cached to improve performance
- **Lazy Loading**: Components are loaded on demand
- **Optimized Queries**: Specific field selection reduces payload size

## Security

- **Environment Variables**: Sensitive keys are stored in environment variables
- **API Key Protection**: API keys are server-side only
- **Input Validation**: All user inputs are validated and sanitized
- **Authentication**: Secure authentication via Supabase
