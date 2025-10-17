# ABCresearch Documentation

Welcome to the ABCresearch documentation. This folder contains comprehensive documentation covering all aspects of the application.

## Documentation Structure

### [0. Overview](./0-overview.md)
**Purpose**: High-level overview of the application's functionalities and architecture

**Contents**:
- Executive summary and core purpose
- Key features and capabilities
- User workflow and typical research session
- Technical architecture overview
- Data flow diagrams
- Technology stack summary
- Use cases and applications
- Performance characteristics and security features

**Best for**: Understanding what the application does and how it works at a high level

---

### [1. Frontend Documentation](./1-frontend.md)
**Purpose**: Detailed documentation of the client-side architecture and components

**Contents**:
- Frontend technology stack (React, TypeScript, Vite)
- Project structure and file organization
- Component architecture and hierarchy
- Service layer (client-side business logic)
- Type system and TypeScript definitions
- State management patterns
- API communication
- Styling approach with TailwindCSS
- Performance optimizations
- Error handling
- Development workflow

**Best for**: Frontend developers working on UI components and client-side logic

---

### [2. Backend Documentation](./2-backend.md)
**Purpose**: Comprehensive guide to server-side architecture and API endpoints

**Contents**:
- Backend architecture overview (serverless functions)
- API endpoints detailed specifications
  - Clinical trials search
  - Research papers search
  - AI query enhancement
  - Drug name extraction
  - Conversational AI responses
  - Slide generation
  - PDF table extraction
- Database architecture (Supabase PostgreSQL)
- Authentication flow (Supabase Auth)
- Environment variables
- API rate limiting strategies
- Error handling patterns
- Security considerations
- Performance optimizations
- Deployment configuration

**Best for**: Backend developers working on API endpoints and database operations

---

### [3. Design Scheme](./3-design-scheme.md)
**Purpose**: Complete design system documentation for consistent UI/UX

**Contents**:
- Design philosophy and principles
- Color system (primary, semantic, usage guidelines)
- Typography (font stack, type scale, weights, usage)
- Spacing system and layout guidelines
- Layout patterns (centered, split-screen, full-screen, modal)
- Component design specifications
  - Buttons, cards, inputs, badges, modals, headers
  - Trial/paper cards, guest mode indicator
- Iconography (Lucide React icons)
- Animation and transitions
- Responsive design strategy
- Accessibility considerations
- Design tokens reference

**Best for**: Designers and frontend developers maintaining visual consistency

---

## Quick Start Guide

### For New Developers

1. **Start with**: [0. Overview](./0-overview.md) - Understand what the app does
2. **Then read**: [1. Frontend](./1-frontend.md) or [2. Backend](./2-backend.md) depending on your role
3. **Reference**: [3. Design Scheme](./3-design-scheme.md) when building UI components

### For Designers

1. **Start with**: [3. Design Scheme](./3-design-scheme.md) - Learn the design system
2. **Then read**: [0. Overview](./0-overview.md) - Understand user workflows
3. **Reference**: [1. Frontend](./1-frontend.md) - Learn how components are implemented

### For Product Managers

1. **Start with**: [0. Overview](./0-overview.md) - Understand features and capabilities
2. **Reference**: [1. Frontend](./1-frontend.md) - Understand UI components and user flows

### For DevOps/Infrastructure

1. **Start with**: [2. Backend](./2-backend.md) - Understand deployment architecture
2. **Reference**: [0. Overview](./0-overview.md) - Understand technical stack

---

## Key Concepts

### Architecture Pattern: API Proxy Model

ABCresearch follows a **serverless API proxy pattern**:
- **Frontend**: React SPA with business logic in client-side services
- **Backend**: Vercel serverless functions act as proxies to external APIs
- **Database**: Supabase (PostgreSQL) for data persistence
- **Authentication**: Supabase Auth with JWT tokens

Benefits:
- ✅ API keys protected server-side
- ✅ CORS issues resolved
- ✅ Business logic testable without external dependencies
- ✅ Easy to swap external service providers

### Data Flow

```
User Query
    ↓
AI Intent Classification (Claude)
    ↓
Query Enhancement (Gemini)
    ↓
Parallel API Calls:
  - Clinical Trials API (3 strategies)
  - PubMed API (research papers)
    ↓
Deduplication & Ranking
    ↓
Drug Extraction & Grouping
    ↓
Display Results
    ↓
Market Map Generation (optional)
    ↓
Save to Database (optional)
```

### Core Features Summary

1. **AI-Enhanced Search**: Natural language queries processed through Claude and Gemini
2. **Clinical Trials Intelligence**: Real-time data from ClinicalTrials.gov with smart ranking
3. **Research Papers Discovery**: PubMed integration with automatic paper-to-trial linking
4. **Drug-Centric Analysis**: Automatic drug extraction and grouping with synonym recognition
5. **Market Map Visualization**: AI-powered competitive landscape analysis
6. **Data Extraction**: PDF table extraction and Excel conversion
7. **Project Persistence**: Save and restore complete research sessions

---

## Technology Stack at a Glance

### Frontend
- **React**: 19.1.1
- **TypeScript**: 5.8.3
- **Vite**: 7.1.7
- **TailwindCSS**: 4.1.13
- **Radix UI**: Accessible component primitives
- **Lucide React**: Icon library

### Backend
- **Vercel**: Serverless functions
- **Node.js**: Runtime environment
- **Supabase**: PostgreSQL database + authentication

### External APIs
- **ClinicalTrials.gov API v2**: Clinical trials data
- **PubMed E-utilities**: Research papers
- **Anthropic Claude**: Conversational AI
- **Google Gemini**: Query enhancement

---

## Common Tasks

### Adding a New Feature

1. **Define types** in `src/types/` (if needed)
2. **Create service** in `src/services/` for business logic
3. **Create API proxy** in `api/` (if external API needed)
4. **Build UI components** in `src/components/`
5. **Update Dashboard** to integrate new feature
6. **Document** in appropriate documentation file

### Modifying External API Integration

1. **Update API proxy** in `api/` directory
2. **Update service** in `src/services/` if response format changes
3. **Update types** in `src/types/` if data structure changes
4. **Test** with real API calls
5. **Document** changes in backend documentation

### Adding New UI Component

1. **Design** following design scheme guidelines
2. **Create component** in `src/components/ui/` (if reusable)
3. **Use design tokens** from TailwindCSS config
4. **Ensure accessibility** (focus states, ARIA labels)
5. **Document** in design scheme documentation

---

## Debugging Tips

### Frontend Issues
- Check browser console for errors
- Verify API responses in Network tab
- Ensure TypeScript types match API responses
- Check React DevTools for component state

### Backend Issues
- Check Vercel function logs
- Verify environment variables are set
- Test external API calls with curl/Postman
- Check rate limiting delays

### Database Issues
- Verify Supabase connection
- Check Row Level Security policies
- Ensure user is authenticated for protected operations
- Use Supabase dashboard to inspect data

---

## Contributing

When contributing to the codebase:

1. **Follow existing patterns**: API proxy for external calls, services for business logic
2. **Maintain type safety**: Define TypeScript interfaces for all data structures
3. **Write clean code**: Meaningful variable names, comments for complex logic
4. **Test thoroughly**: Manual testing of all user flows
5. **Update documentation**: Keep these docs in sync with code changes

---

## Additional Resources

- **GitHub Repository**: [Link to repo]
- **Supabase Dashboard**: [Link to Supabase project]
- **Vercel Dashboard**: [Link to Vercel project]
- **Design Figma**: [Link to Figma if applicable]

---

## Documentation Maintenance

These documentation files should be updated whenever:
- New features are added
- Architecture changes are made
- Design system is modified
- External APIs are changed
- Database schema is updated

**Last Updated**: October 17, 2025

---

## Need Help?

- **For code questions**: Check the relevant documentation file
- **For design questions**: See [3. Design Scheme](./3-design-scheme.md)
- **For architecture questions**: See [0. Overview](./0-overview.md)
- **For API questions**: See [2. Backend](./2-backend.md)

Happy coding! 🚀

