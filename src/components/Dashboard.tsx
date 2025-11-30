/* eslint-disable */
import React, { useState, useEffect, useMemo, memo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LogOut, Menu } from 'lucide-react'
import { CreateProjectModal } from '@/components/CreateProjectModal'
import { GraphCodeExecutor } from '@/components/GraphCodeExecutor'
import type { TableData, GraphifyResult } from '@/types/extraction'
import { Button } from '@/components/ui/button'
import { GatherSearchResultsService } from '@/services/gatherSearchResults'
import type { PubMedArticle } from '@/types/papers'
import type { SavedMarketMap } from '@/services/marketMapService'
import type { DrugGroup } from '@/services/drugGroupingService'
import { ExtractDrugNamesService } from '@/services/extractDrugNames'
import type { ClinicalTrial } from '@/types/trials'
import type { SlideData } from '@/services/slideAPI'
import type { PressRelease } from '@/types/press-releases'
import type { IRDeck } from '@/types/ir-decks'
import type { ChatMessage } from '@/types/chat'
import { InitialResearchView } from '@/components/dashboard/views/InitialResearchView'
import { MarketMapCombinedView } from '@/components/dashboard/views/MarketMapCombinedView'
import { PipelineView } from '@/components/dashboard/views/PipelineView'
import { DataExtractionView } from '@/components/dashboard/views/DataExtractionView'
import { RealtimeFeedView } from '@/components/dashboard/views/RealtimeFeedView'
import { ResearchSplitView } from '@/components/dashboard/views/ResearchSplitView'
import { ResearchChatView } from '@/components/dashboard/views/ResearchChatView'

interface DashboardProps {
  initialShowSavedMaps?: boolean;
  projectName?: string;
  projectId?: number | null;
  showHeader?: boolean; // Whether to show Dashboard's own header (false when inside AppShell)
  insideAppShell?: boolean; // Whether Dashboard is rendered inside AppShell (hides hamburger/sign-out, shows only tabs)
  initialView?: string; // Initial view mode from URL routing (research, pipeline, marketmap, dataextraction, realtimefeed)
}

export function Dashboard({ initialShowSavedMaps = false, projectName = '', projectId = null, showHeader = true, insideAppShell = false, initialView = 'research' }: DashboardProps) {
  const { signOut, isGuest, exitGuestMode } = useAuth()
  const navigate = useNavigate()
  const urlParams = useParams<{ projectId?: string }>()
  
  // Get projectId from props or URL params
  const effectiveProjectId = projectId ?? (urlParams.projectId && urlParams.projectId !== 'null' ? parseInt(urlParams.projectId, 10) : null)
  
  const handleSignOut = async () => {
    console.log('Logout button clicked!');
    try {
      await signOut();
      console.log('Sign out successful');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }


  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  }

  // Paper context handlers
  const handleAddPaperToContext = (paper: PubMedArticle) => {
    // Check if paper is already in context
    if (selectedPapers.some(p => p.pmid === paper.pmid)) {
      return; // Already added
    }
    setSelectedPapers(prev => [...prev, paper]);
  }

  const handleRemovePaperFromContext = (pmid: string) => {
    setSelectedPapers(prev => prev.filter(p => p.pmid !== pmid));
  }

  const handleClearContext = () => {
    setSelectedPapers([]);
    setSelectedPressReleases([]);
    setSelectedExtractions([]);
    setShowContextPanel(false);
    setShowGraphSuggestion(false);
  }

  const isPaperInContext = (pmid: string) => {
    return selectedPapers.some(p => p.pmid === pmid);
  }

    // Press Release context handlers
    const handleAddPressReleaseToContext = (pressRelease: PressRelease) => {
      // Check if press release is already in context
      if (selectedPressReleases.some(pr => pr.id === pressRelease.id)) {
        return; // Already added
      }
      setSelectedPressReleases(prev => [...prev, pressRelease]);
    }

    const handleRemovePressReleaseFromContext = (id: string) => {
      setSelectedPressReleases(prev => prev.filter(pr => pr.id !== id));
    }

    const isPressReleaseInContext = (id: string) => {
      return selectedPressReleases.some(pr => pr.id === id);
    }

    // PDF Extraction context handlers
    const handleAddExtractionToContext = (extraction: {
      jobId: string, 
      fileName: string, 
      markdownContent: string, 
      hasTables: boolean,
      tablesData?: TableData[];
      graphifyResults?: GraphifyResult[];
    }) => {
      // Check if extraction is already in context
      if (selectedExtractions.some(e => e.jobId === extraction.jobId)) {
        return; // Already added
      }
      setSelectedExtractions(prev => [...prev, extraction]);
      
      // Show graph suggestion if this extraction has tables
      if (extraction.hasTables) {
        setShowGraphSuggestion(true);
      }
      
      // Switch to research view so user can see the chat
      setViewMode('research');
      setHasSearched(true);
      
      // Update URL if inside AppShell
      if (insideAppShell && effectiveProjectId !== null) {
        navigate(`/app/project/${effectiveProjectId}/research`, { replace: true });
      }
    }

    const handleRemoveExtractionFromContext = (jobId: string) => {
      setSelectedExtractions(prev => prev.filter(e => e.jobId !== jobId));
      
      // Hide graph suggestion if no more tables in context
      const remainingExtractions = selectedExtractions.filter(e => e.jobId !== jobId);
      if (!remainingExtractions.some(e => e.hasTables)) {
        setShowGraphSuggestion(false);
      }
    }

    const isExtractionInContext = (jobId: string) => {
      return selectedExtractions.some(e => e.jobId === jobId);
    }

    // Handler for generating efficacy comparison graph
    const handleGenerateEfficacyGraph = async () => {
      const message = 'Generate an endpoint efficacy comparison graph from the tables in the extraction context.';
      // Trigger the message send
      setTimeout(() => {
        handleSendMessage(message);
      }, 100);
    }

    const handleLoadSavedMap = async (savedMap: SavedMarketMap) => {
      console.log('Loading saved map:', savedMap);
      console.log('Project ID:', savedMap.project_id);
      
    
    // COMPLETELY REPLACE all current state with the loaded project's state
    setCurrentProjectId(savedMap.project_id); // Use project_id, not map id
    setSlideData(savedMap.slide_data);
    setLastQuery(savedMap.query);
    setHasSearched(true);
    setViewMode('marketmap');
    
    // Restore chat history (replace current chat history completely)
    if (savedMap.chat_history && Array.isArray(savedMap.chat_history) && savedMap.chat_history.length > 0) {
      console.log('Setting chat history:', savedMap.chat_history);
      setChatHistory(savedMap.chat_history);
    } else {
      console.log('No chat history to restore - clearing current chat history');
      setChatHistory([]); // Clear current chat history
    }
    
    // Fetch from normalized tables if project_id exists, otherwise fallback to JSONB
    if (savedMap.project_id) {
      console.log('[Dashboard] Fetching from normalized tables for project:', savedMap.project_id);
      try {
        // Dynamic imports to avoid circular dependencies
        const { getProjectTrials } = await import('@/services/trialService');
        const { getProjectPapers } = await import('@/services/paperService');
        
        const [trials, papers] = await Promise.all([
          getProjectTrials(savedMap.project_id),
          getProjectPapers(savedMap.project_id)
        ]);
        
        console.log('[Dashboard] Loaded from normalized tables:', { 
          trials: trials.length, 
          papers: papers.length 
        });
        
        // If normalized tables are empty (dual-write not complete), fallback to JSONB
        const trialsEmpty = trials.length === 0 && savedMap.trials_data && savedMap.trials_data.length > 0;
        const papersEmpty = papers.length === 0 && savedMap.papers_data && savedMap.papers_data.length > 0;
        
        if (trialsEmpty || papersEmpty) {
          console.log('[Dashboard] Normalized tables incomplete, using JSONB fallback');
          setTrials(savedMap.trials_data || []);
          setPapers(savedMap.papers_data || []);
        } else {
          setTrials(trials);
          setPapers(papers);
        }
      } catch (error) {
        console.error('[Dashboard] Error loading from normalized tables, falling back to JSONB:', error);
        // Fallback to JSONB if normalized tables fail
        setTrials(savedMap.trials_data || []);
        setPapers(savedMap.papers_data || []);
      }
    } else {
      // Legacy: No project_id, use JSONB data
      console.log('[Dashboard] No project_id, using JSONB data');
      setTrials(savedMap.trials_data || []);
      setPapers(savedMap.papers_data || []);
    }
    
    // Clear any errors
    setSlideError(null);
    setGeneratingSlide(false);
  }

  const clearCurrentSession = () => {
    console.log('Clearing current session');
    setCurrentProjectId(null);
    setTrials([]);
    setSlideData(null);
    setLastQuery('');
    setHasSearched(false);
    setChatHistory([]);
    setPapers([]);
    setPressReleases([]);
    setSlideError(null);
    setGeneratingSlide(false);
    setViewMode('research');
    setDrugGroups([]);
    setSelectedDrug(null);
    setShowDrugModal(false);
    setExtractingDrugs(false);
    setSearchProgress({ current: 0, total: 0 });
    setInitialSearchQueries(null);
    setSelectedExtractions([]);
    setShowGraphSuggestion(false);
  }

  const handleDeleteSavedMap = (_id: number) => {
    // If we're currently viewing the deleted map, clear the view
    if (currentProjectId === _id) {
      clearCurrentSession();
    }
  }

  // Note: message state removed - now managed by individual view components
  const [trials, setTrials] = useState<ClinicalTrial[]>([])
  const [loading, setLoading] = useState(false)
  const [lastQuery, setLastQuery] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [papers, setPapers] = useState<PubMedArticle[]>([])
  const [, setPressReleases] = useState<PressRelease[]>([])
  const [, setIRDecks] = useState<IRDeck[]>([])
  const [, setPapersLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'research' | 'pipeline' | 'marketmap' | 'dataextraction' | 'realtimefeed'>(
    initialShowSavedMaps ? 'marketmap' : (initialView as any) || 'research'
  )
  
  // Sync viewMode with URL changes when inside AppShell
  useEffect(() => {
    if (insideAppShell && initialView) {
      setViewMode(initialView as any)
    }
  }, [initialView, insideAppShell])
  
  const [slideData, setSlideData] = useState<SlideData | null>(null)
  const [generatingSlide, setGeneratingSlide] = useState(false)
  const [slideError, setSlideError] = useState<string | null>(null)
  const [pipelineCandidates, setPipelineCandidates] = useState<any[]>([])
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(projectId)
  const [currentProjectName, setCurrentProjectName] = useState<string>(projectName)
  const [showProjectsDropdown, setShowProjectsDropdown] = useState(false)
  const [userProjects, setUserProjects] = useState<Array<{id: number, name: string, description?: string}>>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)
  
  // Memoized callbacks to prevent unnecessary re-renders
  const handleToggleContextPanel = useCallback(() => {
    setShowContextPanel(prev => !prev)
  }, [])
  
  // Fetch user's projects on mount
  React.useEffect(() => {
    const fetchUserProjects = async () => {
      if (isGuest) return;
      
      try {
        setLoadingProjects(true)
        const { getUserProjects } = await import('@/services/projectService')
        const projects = await getUserProjects()
        setUserProjects(projects)
        
        // If we have a projectId but no projectName, look it up
        if (projectId && !projectName && projects.length > 0) {
          const project = projects.find(p => p.id === projectId)
          if (project) {
            setCurrentProjectName(project.name)
          }
        }
        
        // If no current project but user has projects, set the first one as current
        if (!projectId && projects.length > 0) {
          setCurrentProjectId(projects[0].id)
          setCurrentProjectName(projects[0].name)
        }
      } catch (error) {
        console.error('Error fetching user projects:', error)
      } finally {
        setLoadingProjects(false)
      }
    }
    
    fetchUserProjects()
  }, [isGuest])
  
  // Set project ID and name when props change
  React.useEffect(() => {
    if (projectId) {
      setCurrentProjectId(projectId)
      console.log('[Dashboard] Project ID prop received:', projectId, '- will trigger project load effect')
    }
    if (projectName) {
      setCurrentProjectName(projectName)
      console.log('New project created:', projectName)
      
      // Refresh projects list when a new project is created
      const refreshProjects = async () => {
        try {
          const { getUserProjects } = await import('@/services/projectService')
          const projects = await getUserProjects()
          setUserProjects(projects)
        } catch (error) {
          console.error('Error refreshing projects:', error)
        }
      }
      refreshProjects()
    }
  }, [projectId, projectName])
  
  // Store chat history per project (in-memory cache + database)
  const projectChatHistoryRef = React.useRef<Map<number, typeof chatHistory>>(new Map())
  const previousProjectIdRef = React.useRef<number | null>(null)
  const chatHistoryRef = React.useRef(chatHistory)
  const saveChatTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Keep ref in sync with state
  React.useEffect(() => {
    chatHistoryRef.current = chatHistory
  }, [chatHistory])
  
  // Auto-save chat history to database (debounced)
  React.useEffect(() => {
    if (currentProjectId === null || chatHistory.length === 0) return
    
    // Clear previous timeout
    if (saveChatTimeoutRef.current) {
      clearTimeout(saveChatTimeoutRef.current)
    }
    
    // Debounce: save after 2 seconds of inactivity
    saveChatTimeoutRef.current = setTimeout(async () => {
      try {
        const { saveChatHistory } = await import('@/services/projectService')
        await saveChatHistory(currentProjectId, chatHistory)
        console.log('[Dashboard] Auto-saved chat history to database:', chatHistory.length, 'messages')
      } catch (error) {
        console.error('[Dashboard] Failed to save chat history:', error)
      }
    }, 2000)
    
    return () => {
      if (saveChatTimeoutRef.current) {
        clearTimeout(saveChatTimeoutRef.current)
      }
    }
  }, [chatHistory, currentProjectId])

  // Load/Save chat history when switching projects
  React.useEffect(() => {
    console.log('[Dashboard] Project effect triggered. Current:', currentProjectId, 'Previous:', previousProjectIdRef.current)
    console.log('[Dashboard] Current chat length:', chatHistoryRef.current.length)
    console.log('[Dashboard] Saved chats in cache:', Array.from(projectChatHistoryRef.current.keys()))
    
    const isProjectSwitch = currentProjectId !== null && currentProjectId !== previousProjectIdRef.current && previousProjectIdRef.current !== null
    const isInitialLoad = currentProjectId !== null && previousProjectIdRef.current === null
    
    if (isProjectSwitch || isInitialLoad) {
    if (isProjectSwitch) {
      console.log('[Dashboard] ✅ Project switched from', previousProjectIdRef.current, 'to', currentProjectId)
      
        // FIRST: Save current chat to PREVIOUS project database immediately (only on switch, not initial load)
      if (chatHistoryRef.current.length > 0 && previousProjectIdRef.current !== null) {
        console.log('[Dashboard] 💾 Saving', chatHistoryRef.current.length, 'messages to PREVIOUS project DB', previousProjectIdRef.current)
        projectChatHistoryRef.current.set(previousProjectIdRef.current, [...chatHistoryRef.current])
        
        // Save to database immediately (don't wait for debounce)
        import('@/services/projectService').then(({ saveChatHistory }) => {
          saveChatHistory(previousProjectIdRef.current!, chatHistoryRef.current).catch(error => {
            console.error('[Dashboard] Failed to save chat on switch:', error)
          })
        })
        }
      } else {
        console.log('[Dashboard] ✅ Initial project load:', currentProjectId)
      }
      
      // THEN: Load chat history and data for new project from database
      console.log('[Dashboard] 📥 Loading chat history for project', currentProjectId, 'from database...')
      
      // Load chat history, search queries, and pipeline candidates
      import('@/services/projectService').then(async ({ loadChatHistory, loadSearchQueries, loadPipelineCandidates }) => {
        try {
          const [dbChat, searchQueries, pipelineCands] = await Promise.all([
            loadChatHistory(currentProjectId),
            loadSearchQueries(currentProjectId),
            loadPipelineCandidates(currentProjectId)
          ])
          
          // Load search queries
          if (searchQueries) {
            console.log('[Dashboard] ✅ Loaded search queries for project', currentProjectId)
            setInitialSearchQueries(searchQueries)
          } else {
            setInitialSearchQueries(null)
          }
          
          // Load pipeline candidates
          if (pipelineCands && pipelineCands.length > 0) {
            console.log('[Dashboard] ✅ Loaded', pipelineCands.length, 'pipeline candidates for project', currentProjectId)
            setPipelineCandidates(pipelineCands)
          } else {
            console.log('[Dashboard] ✅ No pipeline candidates for project', currentProjectId)
            setPipelineCandidates([])
          }
          
          // Load chat history
          if (dbChat && dbChat.length > 0) {
            console.log('[Dashboard] ✅ Loaded', dbChat.length, 'messages from database for project', currentProjectId)
            setChatHistory([...dbChat])
            projectChatHistoryRef.current.set(currentProjectId, [...dbChat])
            // Set hasSearched to true so the UI shows the research view with chat history
            setHasSearched(true)
            // Only set viewMode to research if NOT inside AppShell with URL routing
            // When inside AppShell, the URL controls the view mode via initialView prop
            if (!insideAppShell) {
              setViewMode('research')
            }
          } else {
            // Check in-memory cache as fallback
            const cachedChat = projectChatHistoryRef.current.get(currentProjectId)
            if (cachedChat && cachedChat.length > 0) {
              console.log('[Dashboard] ✅ Loading', cachedChat.length, 'messages from cache for project', currentProjectId)
              setChatHistory([...cachedChat])
              // Set hasSearched to true so the UI shows the research view with chat history
              setHasSearched(true)
              // Only set viewMode to research if NOT inside AppShell with URL routing
              if (!insideAppShell) {
                setViewMode('research')
              }
            } else {
              console.log('[Dashboard] ✅ No chat history for project', currentProjectId, ', starting fresh')
              setChatHistory([])
              setHasSearched(false)
              // Only set viewMode to research if NOT inside AppShell with URL routing
              if (!insideAppShell) {
                setViewMode('research')
              }
            }
          }
        } catch (error) {
          console.error('[Dashboard] Failed to load chat history:', error)
          setChatHistory([])
          setHasSearched(false)
          setInitialSearchQueries(null)
        }
      })
      
      // Load trials, papers, and drug groups for the new project
      console.log('[Dashboard] 📥 Loading project data (trials, papers, drug groups) for project', currentProjectId)
      Promise.all([
        import('@/services/trialService').then(({ getProjectTrials }) => getProjectTrials(currentProjectId)),
        import('@/services/paperService').then(({ getProjectPapers }) => getProjectPapers(currentProjectId)),
        import('@/services/drugAssociationService').then(({ loadDrugGroups }) => loadDrugGroups(currentProjectId))
      ]).then(([projectTrials, projectPapers, drugGroups]) => {
        console.log('[Dashboard] ✅ Loaded project data:', {
          trials: projectTrials.length,
          papers: projectPapers.length,
          drugGroups: drugGroups.length
        })
        
        setTrials(projectTrials)
        setPapers(projectPapers)
        setDrugGroups(drugGroups)
        
        // Extract press releases and IR decks from drug groups
        const allPressReleases: PressRelease[] = []
        const allIRDecks: IRDeck[] = []
        
        drugGroups.forEach(drugGroup => {
          allPressReleases.push(...drugGroup.pressReleases)
          allIRDecks.push(...drugGroup.irDecks)
        })
        
        setPressReleases(allPressReleases)
        setIRDecks(allIRDecks)
        
        const totalTrials = drugGroups.reduce((sum, dg) => sum + dg.trials.length, 0)
        const totalPapers = drugGroups.reduce((sum, dg) => sum + dg.papers.length, 0)
        console.log('[Dashboard] ✅ Set drugGroups state:', {
          count: drugGroups.length,
          totalTrials,
          totalPapers,
          sample: drugGroups.slice(0, 3).map(dg => ({
            name: dg.drugName,
            trials: dg.trials.length,
            papers: dg.papers.length
          }))
        })
      }).catch(error => {
        console.error('[Dashboard] Failed to load project data:', error)
      setTrials([])
      setPapers([])
        setDrugGroups([])
        setPressReleases([])
        setIRDecks([])
      })
      
      // Clear other state when switching projects
      setPressReleases([])
      setLastQuery('')
      setSelectedDrug(null)
      setSelectedPapers([])
      setSelectedPressReleases([])
      setSelectedExtractions([])
      setShowContextPanel(false)
      setShowGraphSuggestion(false)
    }
    
    // Update previous project ref
    previousProjectIdRef.current = currentProjectId
  }, [currentProjectId])

  // Auto-save pipeline candidates when they change
  useEffect(() => {
    if (currentProjectId && pipelineCandidates.length > 0) {
      console.log('[Dashboard] Pipeline candidates changed, auto-saving to database...')
      import('@/services/projectService').then(({ savePipelineCandidates }) => {
        savePipelineCandidates(currentProjectId, pipelineCandidates).catch(error => {
          console.error('[Dashboard] Failed to save pipeline candidates:', error)
        })
      })
    }
  }, [pipelineCandidates, currentProjectId])
  
  // Drug grouping state
  const [drugGroups, setDrugGroups] = useState<DrugGroup[]>([])
  const [selectedDrug, setSelectedDrug] = useState<DrugGroup | null>(null)
  const [showDrugModal, setShowDrugModal] = useState(false)
  
  // Two-stage search state
  const [, setExtractingDrugs] = useState(false)
  const [searchProgress, setSearchProgress] = useState({ current: 0, total: 0 })
  const [initialSearchQueries, setInitialSearchQueries] = useState<{
    originalQuery: string;
    strategies?: import('@/services/gatherSearchResults').StrategyResult[];
  } | null>(null)
  
  // Paper context state (for AI conversation)
  const [selectedPapers, setSelectedPapers] = useState<PubMedArticle[]>([])
  const [selectedPressReleases, setSelectedPressReleases] = useState<PressRelease[]>([])
  const [selectedExtractions, setSelectedExtractions] = useState<Array<{
    jobId: string, 
    fileName: string, 
    markdownContent: string, 
    hasTables: boolean,
    tablesData?: Array<{
      index: number;
      headers: string[];
      rows: string[][];
      rawMarkdown: string;
    }>;
    graphifyResults?: Array<{
      imageName: string;
      isGraph: boolean;
      graphType?: string;
      reason?: string;
      pythonCode?: string;
      data?: Record<string, unknown>;
      assumptions?: string;
      error?: string;
      renderedImage?: string;
      renderError?: string;
      renderTimeMs?: number;
    }>;
  }>>([])
  const [showContextPanel, setShowContextPanel] = useState(false)
  const [showGraphSuggestion, setShowGraphSuggestion] = useState(false)

  // Close menu, context panel, and projects dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      if (isMenuOpen && !target.closest('.menu-container')) {
        setIsMenuOpen(false);
      }
      
      if (showContextPanel && !target.closest('.context-panel-container')) {
        setShowContextPanel(false);
      }
      
      if (showProjectsDropdown && !target.closest('.projects-dropdown-container')) {
        setShowProjectsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen, showContextPanel, showProjectsDropdown]);

  // Debug logging for MarketMap props
  useEffect(() => {
    if (viewMode === 'marketmap') {
      console.log('Dashboard passing to MarketMap:', {
        chatHistory,
        papers,
        chatHistoryLength: chatHistory?.length,
        papersLength: papers?.length,
        chatHistoryType: typeof chatHistory,
        papersType: typeof papers
      });
    }
  }, [viewMode, chatHistory, papers]);

  const handleSendMessage = async (messageToSend: string) => {
    if (!messageToSend || !messageToSend.trim()) return;

    const userMessage = messageToSend.trim();
    const messageContextPapers = [...selectedPapers]; // Snapshot current context
    const messageContextPressReleases = [...selectedPressReleases]; // Snapshot press releases context
    const messageContextExtractions = [...selectedExtractions]; // Snapshot PDF extractions context
    setHasSearched(true); // Switch to wide screen chat interface after first message

    // Add user message to chat history with context papers, press releases, and extractions
    setChatHistory(prev => [...prev, {
      type: 'user',
      message: userMessage,
      contextPapers: messageContextPapers.length > 0 ? messageContextPapers : undefined,
      contextPressReleases: messageContextPressReleases.length > 0 ? messageContextPressReleases : undefined,
      contextExtractions: messageContextExtractions.length > 0 ? messageContextExtractions : undefined
    }]);

    try {
      setLoading(true);

      console.log('Sending request to generate-response API with query:', userMessage);
      console.log('Chat history being sent:', chatHistory.length, 'messages');
      console.log('Context papers:', selectedPapers.length, 'press releases:', selectedPressReleases.length, 'extractions:', selectedExtractions.length);

      // First, get intent classification and response with conversation context
      const response = await fetch('/api/generate-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userQuery: userMessage,
          chatHistory: chatHistory,
          contextPapers: selectedPapers.length > 0 ? selectedPapers : undefined,
          contextPressReleases: selectedPressReleases.length > 0 ? selectedPressReleases : undefined,
          contextExtractions: selectedExtractions.length > 0 ? selectedExtractions : undefined
        })
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('API response data:', data);
      
      // Add AI response to chat history
      console.log('Adding response to chat history:', data.response);
      console.log('Search suggestions:', data.searchSuggestions);
      console.log('shouldSearch:', data.shouldSearch);
      console.log('searchQuery:', data.searchQuery);
      console.log('Graph code:', data.graphCode ? 'Present' : 'None');
      
      setChatHistory(prev => {
        const newHistory = [...prev, { 
          type: 'system' as const, 
          message: data.response,
          searchSuggestions: data.searchSuggestions || [],
          graphCode: data.graphCode
        }];
        console.log('New chat history:', newHistory);
        return newHistory;
      });

      // If the AI suggests a search, we'll handle that in the next phase
      // For now, we'll just show the conversational response
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      setChatHistory(prev => [...prev, { 
        type: 'system', 
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Deep Dive: Run a targeted search for a specific drug
   * Searches by drug name specifically, ordered by recency and participant size
   */
  const handleDrugSpecificSearch = async (drugName: string) => {
    try {
      console.log(`🎯 Deep Dive search for: "${drugName}"`);
      
      // Progress callback for Deep Dive search
      const onProgress = (message: string) => {
        setChatHistory(prev => {
          const filtered = prev.filter(item => !item.message.startsWith('progress:'));
          return [...filtered, {
            type: 'system' as const,
            message: `progress:${message}`,
            searchSuggestions: []
          }];
        });
      };
      
      // Initial notification
      onProgress(`Searching for comprehensive data on "${drugName}"...`);
      
      // Search specifically for this drug
      const result = await GatherSearchResultsService.gatherSearchResults(drugName, onProgress);
      
      // Sort trials by recency and participant size
      const sortedTrials = [...result.trials].sort((a, b) => {
        // First by start date (most recent first)
        const dateA = a.startDate || '';
        const dateB = b.startDate || '';
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA);
        }
        // Then by enrollment size (largest first)
        const enrollA = a.enrollment || 0;
        const enrollB = b.enrollment || 0;
        return enrollB - enrollA;
      });
      
      // Sort papers by publication date (most recent first)
      const sortedPapers = [...result.papers].sort((a, b) => {
        return b.publicationDate.localeCompare(a.publicationDate);
      });
      
      // Update the drug group with sorted results
      const updatedDrugGroup: DrugGroup = {
        drugName,
        normalizedName: drugName.toLowerCase(),
        papers: sortedPapers,
        trials: sortedTrials,
        pressReleases: result.pressReleases || [],
        irDecks: result.irDecks || [],
        totalResults: sortedPapers.length + sortedTrials.length + (result.pressReleases?.length || 0) + (result.irDecks?.length || 0)
      };
      
      // Update drugGroups to include this updated drug or add it if new
      let updatedDrugGroups: DrugGroup[] = [];
      setDrugGroups(prev => {
        const existing = prev.find(g => g.normalizedName === drugName.toLowerCase());
        if (existing) {
          // Update existing drug
          updatedDrugGroups = prev.map(g => 
            g.normalizedName === drugName.toLowerCase() ? updatedDrugGroup : g
          ).sort((a, b) => b.totalResults - a.totalResults);
        } else {
          // Add new drug
          updatedDrugGroups = [...prev, updatedDrugGroup].sort((a, b) => b.totalResults - a.totalResults);
        }
        return updatedDrugGroups;
      });
      
      // Save drug groups to database (background task)
      if (currentProjectId) {
        console.log('[Dashboard] Deep Dive: Saving updated drug groups to database...');
        import('@/services/drugAssociationService').then(({ saveDrugGroups }) => {
          saveDrugGroups(currentProjectId, updatedDrugGroups).catch(error => {
            console.error('[Dashboard] Deep Dive: Failed to save drug groups:', error);
          });
        });
      }
      
      // Open the drug modal to show results
      setSelectedDrug(updatedDrugGroup);
      
      // Notify success (remove progress messages)
      setChatHistory(prev => {
        const filtered = prev.filter(item => !item.message.startsWith('progress:'));
        const parts = [`${sortedTrials.length} trials`, `${sortedPapers.length} papers`];
        if (result.pressReleases && result.pressReleases.length > 0) {
          parts.push(`${result.pressReleases.length} press releases`);
        }
        if (result.irDecks && result.irDecks.length > 0) {
          parts.push(`${result.irDecks.length} IR decks`);
        }
        return [...filtered, {
          type: 'system' as const,
          message: `Found ${parts.join(', ')} for "${drugName}" (sorted by recency and size)`,
          searchSuggestions: []
        }];
      });
      
      console.log(`✅ Deep Dive complete: ${sortedTrials.length} trials, ${sortedPapers.length} papers, ${result.pressReleases?.length || 0} press releases, ${result.irDecks?.length || 0} IR decks`);
    } catch (error) {
      console.error('Error in drug-specific search:', error);
      setChatHistory(prev => [...prev, {
        type: 'system' as const,
        message: `Error searching for "${drugName}". Please try again.`,
        searchSuggestions: []
      }]);
    }
  };

  const handleSearchSuggestion = async (suggestion: {id: string, label: string, query: string, description?: string}) => {
    console.log('Search suggestion clicked:', suggestion);
    
    try {
      // Show split screen immediately
      setHasSearched(true);
      setLoading(true);
      setLastQuery(suggestion.query);
      
      // Stage 1: Initial search and drug extraction
      console.log('Stage 1: Performing initial search and extracting drugs...');
      setExtractingDrugs(true);
      
      // Progress callback to update chat with detailed steps
      const onProgress = (message: string, data?: { trials?: number; papers?: number; pressReleases?: number; irDecks?: number }) => {
        setChatHistory(prev => {
          // Remove any previous progress messages
          const filtered = prev.filter(item => !item.message.startsWith('progress:'));
          return [...filtered, { 
            type: 'system' as const, 
            message: `progress:${message}`,
            searchSuggestions: [],
            data
          }];
        });
      };
      
      // Perform initial search with progress callback
      const initialResult = await GatherSearchResultsService.gatherSearchResults(suggestion.query, onProgress);
      
      // Save the initial search queries and strategies for display
      const searchQueries = {
        originalQuery: suggestion.query,
        strategies: initialResult.searchStrategies
      };
      setInitialSearchQueries(searchQueries);
      
      // Save search queries to database (background task)
      if (currentProjectId) {
        import('@/services/projectService').then(({ saveSearchQueries }) => {
          saveSearchQueries(currentProjectId, searchQueries).catch(error => {
            console.error('[Dashboard] Failed to save search queries:', error);
          });
        });
      }
      
      // Extract unique drug names from the results
      const drugExtractionResult = await ExtractDrugNamesService.extractFromSearchResults(
        initialResult.trials,
        initialResult.papers,
        suggestion.query
      );
      
      const uniqueDrugNames = drugExtractionResult.uniqueDrugNames;
      console.log(`Stage 1 complete: Found ${uniqueDrugNames.length} unique drugs:`, uniqueDrugNames);
      
      // Attach extracted drugs to each trial/paper object
      const trialsWithDrugs = initialResult.trials.map(trial => {
        const drugsForTrial = drugExtractionResult.trialDrugs
          .filter(drug => drug.source === trial.nctId)
          .map(drug => drug.name);
        return {
          ...trial,
          extractedDrugs: [...new Set(drugsForTrial)] // Deduplicate
        };
      });
      
      const papersWithDrugs = initialResult.papers.map(paper => {
        const drugsForPaper = drugExtractionResult.paperDrugs
          .filter(drug => drug.source === paper.pmid)
          .map(drug => drug.name);
        return {
          ...paper,
          extractedDrugs: [...new Set(drugsForPaper)] // Deduplicate
        };
      });
      
      // Update the search results with enhanced data
      setTrials(trialsWithDrugs);
      setPapers(papersWithDrugs);
      
      // Update chat with completion (remove progress messages)
      setChatHistory(prev => {
        const filtered = prev.filter(item => !item.message.startsWith('progress:'));
        return [...filtered, { 
          type: 'system' as const, 
          message: `Discovery complete! Found ${uniqueDrugNames.length} drugs with ${trialsWithDrugs.length} clinical trials, ${papersWithDrugs.length} research papers, ${initialResult.pressReleases?.length || 0} press releases, and ${initialResult.irDecks?.length || 0} IR decks. Results are displayed on the right.`,
          searchSuggestions: []
        }];
      });
      
      // Group trials and papers by extracted drug names (NO Stage 2 searches!)
      console.log(`Grouping ${trialsWithDrugs.length} trials and ${papersWithDrugs.length} papers by ${uniqueDrugNames.length} drugs...`);
      setExtractingDrugs(false);
      
      // Create drug groups from the discovery search results
      const allDrugGroups: DrugGroup[] = uniqueDrugNames.map(drugName => {
        const normalizedDrugName = drugName.toLowerCase();
        
        // Find trials mentioning this drug (use enhanced trials with extractedDrugs)
        const drugTrials = trialsWithDrugs.filter(trial => {
          const trialText = [
            trial.briefTitle,
            trial.officialTitle,
            ...(trial.interventions || []),
            ...(trial.conditions || [])
          ].join(' ').toLowerCase();
          return trialText.includes(normalizedDrugName);
        });
        
        // Find papers mentioning this drug (use enhanced papers with extractedDrugs)
        const drugPapers = papersWithDrugs.filter(paper => {
          const paperText = [paper.title, paper.abstract].join(' ').toLowerCase();
          return paperText.includes(normalizedDrugName);
        });

        // Find press releases mentioning this drug
        const drugPressReleases = initialResult.pressReleases.filter(pressRelease => {
          const prText = [pressRelease.title, pressRelease.summary, pressRelease.company].join(' ').toLowerCase();
          return prText.includes(normalizedDrugName);
        });

        // Find IR decks mentioning this drug
        const drugIRDecks = (initialResult.irDecks || []).filter(irDeck => {
          const irText = [irDeck.title, irDeck.company, irDeck.description || ''].join(' ').toLowerCase();
          return irText.includes(normalizedDrugName);
        });

        return {
          drugName,
          normalizedName: normalizedDrugName,
          papers: drugPapers,
          trials: drugTrials,
          pressReleases: drugPressReleases,
          irDecks: drugIRDecks,
          totalResults: drugPapers.length + drugTrials.length + drugPressReleases.length + drugIRDecks.length
        };
      });
      
      // Filter out drugs with no results and sort by total results
      const filteredDrugGroups = allDrugGroups
        .filter(g => g.totalResults > 0)
        .sort((a, b) => b.totalResults - a.totalResults);
      
      console.log(`Grouped into ${filteredDrugGroups.length} drugs with results (${allDrugGroups.length - filteredDrugGroups.length} drugs had no matching trials/papers)`);
      
      // Update state
      setDrugGroups(filteredDrugGroups);
      setTrials(initialResult.trials);
      setPapers(initialResult.papers);
      setPressReleases(initialResult.pressReleases);
      setIRDecks(initialResult.irDecks || []);

      // Save drug groups with their associations to the database (background task)
      if (currentProjectId && filteredDrugGroups.length > 0) {
        console.log('[Dashboard] Saving drug groups to database...');
        import('@/services/drugAssociationService').then(({ saveDrugGroups }) => {
          saveDrugGroups(currentProjectId, filteredDrugGroups).catch(error => {
            console.error('[Dashboard] Failed to save drug groups:', error);
          });
        });
      }

      // Add deduplication warning if present (not common, but good to show)
      const warning = drugExtractionResult.deduplicationWarning;
      if (warning && warning.trim().length > 0) {
        setChatHistory(prev => [...prev, {
          type: 'system' as const,
          message: warning.trim(),
          searchSuggestions: []
        }]);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error executing search suggestion:', errorMessage);
      
      // Remove loading message and add error message
      setChatHistory(prev => {
        const filtered = prev.filter(item => item.message !== 'stage1_loading');
        return [...filtered, { 
          type: 'system' as const, 
          message: `Search failed: ${errorMessage}\n\nPlease try again or contact support if the issue persists.`,
          searchSuggestions: []
        }];
      });
      
      setExtractingDrugs(false);
      // Keep hasSearched as true so user stays on the results screen and can see the error
    } finally {
      setLoading(false);
      setPapersLoading(false);
      setExtractingDrugs(false);
      setSearchProgress({ current: 0, total: 0 });
    }
  }

  // Shared header component
  const Header = ({ currentProjectId }: { currentProjectId?: number | null } = {}) => (
    <div className="h-16 bg-white/80 backdrop-blur-xl border-b border-white/20 z-50 flex items-center relative shadow-sm transition-all duration-300">
      {/* Left Side - Hamburger Menu (only for authenticated users) + Guest Banner + Context Indicator */}
      {/* Only show left side if NOT inside AppShell */}
      {!insideAppShell && (
        <div className="flex items-center gap-3 px-6">
          {/* Hamburger Menu - Only show for authenticated users */}
          {!isGuest && (
          <div className="relative menu-container">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMenuToggle}
              className="bg-white/50 rounded-full shadow-sm hover:shadow-md transition-all border border-gray-200/50 hover:bg-white hover:scale-105 h-10 w-10"
              title="Menu"
            >
              <Menu className="h-5 w-5 text-gray-600 hover:text-gray-900" />
            </Button>
            
            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute top-14 left-0 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 py-2 min-w-[180px] z-50 animate-scale-in origin-top-left">
                <Button
                  variant="ghost"
                  onClick={handleSignOut}
                  className="w-full justify-start px-4 py-3 text-left text-gray-700 hover:bg-gray-50/50 h-auto font-normal"
                >
                  <LogOut className="h-4 w-4 text-gray-500 mr-3" />
                  Sign Out
                </Button>
              </div>
            )}
          </div>
        )}
        
        {/* Guest Mode Indicator */}
        <GuestModeIndicator />
        </div>
      )}
      
      {/* Toggle Buttons - Absolutely positioned center with equal widths */}
      {(projectId !== null || currentProjectId || hasSearched || viewMode === 'pipeline' || viewMode === 'marketmap' || viewMode === 'dataextraction' || viewMode === 'realtimefeed') && (
        <div 
          className="absolute z-20"
          style={{ left: '50%', transform: 'translateX(-50%)' }}
        >
          <div className="flex rounded-full bg-gray-100/50 p-1.5 w-[60rem] border border-white/20 shadow-inner backdrop-blur-sm">
            <div className="relative flex-1 projects-dropdown-container">
              <Button
                variant="ghost"
                onClick={() => setShowProjectsDropdown(!showProjectsDropdown)}
                className={`rounded-full w-full h-9 text-sm font-medium transition-all duration-300 overflow-hidden ${
                  showProjectsDropdown
                    ? 'bg-primary text-primary-foreground shadow-md scale-100 hover:bg-primary'
                    : 'bg-primary/90 text-primary-foreground hover:bg-primary hover:shadow-sm'
                }`}
                title={currentProjectName ? `Project: ${currentProjectName}` : 'Projects'}
              >
                <span className="truncate">
                  {currentProjectName ? `Project: ${currentProjectName}` : 'Projects'}
                </span>
              </Button>
              
              {/* Projects Dropdown */}
              {showProjectsDropdown && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 py-2 min-w-[250px] z-50 animate-scale-in origin-top">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900 text-sm">Your Projects</h3>
                  </div>
                  <div className="py-1 max-h-64 overflow-y-auto custom-scrollbar">
                    {loadingProjects ? (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">
                        Loading projects...
                      </div>
                    ) : userProjects.length > 0 ? (
                      userProjects.map((project) => (
                        <Button
                          key={project.id}
                          variant="ghost"
                          onClick={() => {
                            setCurrentProjectId(project.id)
                            setCurrentProjectName(project.name)
                            setShowProjectsDropdown(false)
                            console.log('Switched to project:', project.name)
                          }}
                          className={`w-full justify-start px-4 py-3 hover:bg-gray-50/50 transition-colors h-auto font-normal ${
                            project.id === currentProjectId ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 w-full">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              project.id === currentProjectId ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                            }`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {project.name}
                              </p>
                              {project.id === currentProjectId && (
                                <p className="text-xs text-blue-600 font-medium">
                                  Current
                                </p>
                              )}
                            </div>
                          </div>
                        </Button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">
                        No projects yet
                      </div>
                    )}
                  </div>
                  
                  {/* Create New Project Button */}
                  <div className="border-t border-gray-100 pt-2 p-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowCreateProjectModal(true)
                        setShowProjectsDropdown(false)
                      }}
                      className="w-full justify-start px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors group h-auto"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-200 group-hover:bg-blue-300 transition-colors">
                          <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-semibold text-blue-700">
                            Create New Project
                          </p>
                        </div>
                      </div>
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              onClick={() => setViewMode('research')}
              className={`rounded-full flex-1 h-9 text-sm font-medium transition-all duration-300 ${
                viewMode === 'research'
                  ? 'bg-white text-gray-900 shadow-sm hover:bg-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              Research
            </Button>
            <Button
              variant="ghost"
              onClick={() => setViewMode('pipeline')}
              className={`rounded-full flex-1 h-9 text-sm font-medium transition-all duration-300 ${
                viewMode === 'pipeline'
                  ? 'bg-white text-gray-900 shadow-sm hover:bg-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              Asset Pipeline
            </Button>
            <Button
              variant="ghost"
              onClick={() => setViewMode('marketmap')}
              className={`rounded-full flex-1 h-9 text-sm font-medium transition-all duration-300 ${
                viewMode === 'marketmap'
                  ? 'bg-white text-gray-900 shadow-sm hover:bg-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              Market Map
            </Button>
            <Button
              variant="ghost"
              onClick={() => setViewMode('dataextraction')}
              className={`rounded-full flex-1 h-9 text-sm font-medium transition-all duration-300 ${
                viewMode === 'dataextraction'
                  ? 'bg-white text-gray-900 shadow-sm hover:bg-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              Data Extraction
            </Button>
            <Button
              variant="ghost"
              onClick={() => setViewMode('realtimefeed')}
              className={`rounded-full flex-1 h-9 text-sm font-medium transition-all duration-300 ${
                viewMode === 'realtimefeed'
                  ? 'bg-white text-gray-900 shadow-sm hover:bg-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              Realtime Feed
            </Button>
          </div>
        </div>
      )}
      
      {/* Vertical center line indicator (hidden but marks the center) */}
      <div className="absolute left-1/2 transform -translate-x-1/2 w-px h-full pointer-events-none"></div>
    </div>
  );

  // Guest mode indicator component with animation
  const GuestModeIndicator = () => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!isGuest) return null;
    
    return (
      <div 
        className={`bg-amber-50 border border-amber-200 rounded-lg shadow-lg transition-all duration-300 ease-in-out ${
          isExpanded ? 'p-3 max-w-xs' : 'p-2 w-12 h-12 flex items-center justify-center cursor-pointer'
        }`}
        onClick={!isExpanded ? () => setIsExpanded(true) : undefined}
      >
          <div className={`flex items-start gap-2 ${isExpanded ? '' : 'items-center justify-center'}`}>
            <svg className={`text-amber-600 flex-shrink-0 ${isExpanded ? 'w-4 h-4 mt-0.5' : 'w-6 h-6'}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {isExpanded && (
              <div className="text-xs relative">
                {/* X button - show when expanded */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                  }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-700 p-0 h-5 w-5"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                <div className="font-medium text-amber-800">Guest Mode</div>
                <div className="text-amber-700 mt-1">Your data won't be saved. 
                  <Button 
                    variant="link"
                    onClick={exitGuestMode}
                    className="text-amber-700 hover:text-amber-900 ml-1 p-0 h-auto font-normal underline"
                  >
                    Sign up to save
                  </Button>
                </div>
              </div>
            )}
          </div>
      </div>
    );
  };

  // Memoize ProjectModal component to prevent recreation on every render
  const ProjectModal = useCallback(() => (
    <CreateProjectModal
      isOpen={showCreateProjectModal}
      onClose={() => setShowCreateProjectModal(false)}
      onConfirm={async (name) => {
        console.log('[Dashboard] Creating new project:', name)
        
        // Block guest users from creating projects
        if (isGuest) {
          console.warn('[Dashboard] Guest users cannot create projects')
          alert('Guest users cannot create projects. Please sign up or sign in to create projects.')
          return
        }
        
        try {
          setCreatingProject(true)
          
          // Import and call createProject service
          const { createProject } = await import('@/services/projectService')
          const project = await createProject(name)
          
          console.log('[Dashboard] Project created successfully:', project)
          
          // Clear current session state before switching to new project
          clearCurrentSession()
          
          // Switch to the new project
          setCurrentProjectId(project.id)
          setCurrentProjectName(project.name)
          
          // Close modal
          setShowCreateProjectModal(false)
          
          // Refresh projects list
          const { getUserProjects } = await import('@/services/projectService')
          const projects = await getUserProjects()
          setUserProjects(projects)
          
          // Navigate to research view
          setViewMode('research')
          
        } catch (error) {
          console.error('[Dashboard] Error creating project:', error)
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          alert(`Failed to create project: ${errorMessage}\n\nPlease check the browser console for more details.`)
        } finally {
          setCreatingProject(false)
        }
      }}
    />
  ), [showCreateProjectModal, isGuest])

  type ViewVariant = 'initial' | 'default';

  // Memoize DashboardLayout to prevent child components from remounting on every keystroke
  const DashboardLayout = useCallback(({
    variant = 'default',
    currentProjectId,
    children
  }: {
    variant?: ViewVariant;
    currentProjectId: number | null;
    children: React.ReactNode;
  }) => {
    if (variant === 'initial') {
      return (
        <div className={showHeader ? "h-screen flex flex-col bg-gray-50" : "h-full flex flex-col bg-gray-50"}>
          <div className={showHeader ? "flex-1 overflow-auto flex items-center justify-center" : "flex-1 overflow-auto flex items-center justify-center"}>
            {children}
          </div>
          {showHeader && (
            <div className="fixed top-0 left-0 right-0 z-50">
              <Header currentProjectId={currentProjectId} />
            </div>
          )}
          <ProjectModal />
        </div>
      )
    }

    return (
      <div className={showHeader ? "h-screen flex flex-col bg-gray-50" : "h-full flex flex-col bg-gray-50"}>
        {showHeader && <Header currentProjectId={currentProjectId} />}
        <div className="flex-1 min-h-0">
          {children}
        </div>
        <ProjectModal />
      </div>
    )
  }, [showHeader])

  if (!hasSearched && viewMode !== 'pipeline' && viewMode !== 'marketmap' && viewMode !== 'dataextraction' && viewMode !== 'realtimefeed') {
    console.log('Rendering initial centered search. hasSearched:', hasSearched, 'viewMode:', viewMode);
    return (
      <DashboardLayout variant="initial" currentProjectId={currentProjectId}>
        <InitialResearchView
          selectedPapers={selectedPapers}
          selectedPressReleases={selectedPressReleases}
          showContextPanel={showContextPanel}
          onToggleContextPanel={handleToggleContextPanel}
          onRemovePaper={handleRemovePaperFromContext}
          onRemovePressRelease={handleRemovePressReleaseFromContext}
          onClearContext={handleClearContext}
          onSendMessage={handleSendMessage}
          loading={loading}
          hasSearched={hasSearched}
        />
      </DashboardLayout>
    );
  }

  // Show combined market map view (includes saved maps)
  if (viewMode === 'marketmap') {
    return (
      <DashboardLayout currentProjectId={currentProjectId}>
        <MarketMapCombinedView
            trials={trials} 
            loading={loading} 
            query={lastQuery}
            slideData={slideData}
            setSlideData={setSlideData}
            generatingSlide={generatingSlide}
            setGeneratingSlide={setGeneratingSlide}
            slideError={slideError}
            setSlideError={setSlideError}
            chatHistory={chatHistory}
            papers={papers}
            drugGroups={drugGroups}
            currentProjectId={currentProjectId}
            onNavigateToResearch={() => setViewMode('research')}
            onLoadMap={handleLoadSavedMap}
            onDeleteMap={handleDeleteSavedMap}
          />
      </DashboardLayout>
    );
  }


  // Asset Development Pipeline mode
  if (viewMode === 'pipeline') {
    return (
      <DashboardLayout currentProjectId={currentProjectId}>
        <PipelineView
            trials={trials} 
            drugGroups={drugGroups}
            query={lastQuery}
            onAddPaperToContext={handleAddPaperToContext}
            isPaperInContext={isPaperInContext}
            pipelineCandidates={pipelineCandidates}
            setPipelineCandidates={setPipelineCandidates}
          />
      </DashboardLayout>
    );
  }

  // Data Extraction mode
  if (viewMode === 'dataextraction') {
    return (
      <DashboardLayout currentProjectId={currentProjectId}>
        <DataExtractionView
          currentProjectId={currentProjectId}
          isVisible
          onAddToChat={handleAddExtractionToContext}
          onRemoveFromChat={handleRemoveExtractionFromContext}
          isExtractionInContext={isExtractionInContext}
        />
      </DashboardLayout>
    );
  }


  // Realtime Feed mode
  if (viewMode === 'realtimefeed') {
    return (
      <DashboardLayout currentProjectId={currentProjectId}>
        <RealtimeFeedView />
      </DashboardLayout>
    );
  }

  // Research mode - split view layout (only when hasSearched is true and we have search results)
  console.log('Checking split screen condition. hasSearched:', hasSearched, 'trials:', trials.length, 'papers:', papers.length);
  if (viewMode === 'research' && hasSearched && (drugGroups.length > 0 || searchProgress.total > 0)) {
    console.log('Rendering split screen');
    return (
      <DashboardLayout currentProjectId={currentProjectId}>
        <ResearchSplitView
          chatHistory={chatHistory}
          selectedPapers={selectedPapers}
          selectedPressReleases={selectedPressReleases}
          selectedExtractions={selectedExtractions}
          showContextPanel={showContextPanel}
          onToggleContextPanel={handleToggleContextPanel}
          onRemovePaper={handleRemovePaperFromContext}
          onRemovePressRelease={handleRemovePressReleaseFromContext}
          onRemoveExtraction={handleRemoveExtractionFromContext}
          onClearContext={handleClearContext}
          onSendMessage={handleSendMessage}
          handleSearchSuggestion={handleSearchSuggestion}
          loading={loading}
          selectedDrug={selectedDrug}
          setSelectedDrug={setSelectedDrug}
          drugGroups={drugGroups}
          searchProgress={searchProgress}
          handleDrugSpecificSearch={handleDrugSpecificSearch}
          initialSearchQueries={initialSearchQueries}
          showDrugModal={showDrugModal}
          setShowDrugModal={setShowDrugModal}
          handleAddPaperToContext={handleAddPaperToContext}
          isPaperInContext={isPaperInContext}
          handleAddPressReleaseToContext={handleAddPressReleaseToContext}
          isPressReleaseInContext={isPressReleaseInContext}
        />
      </DashboardLayout>
    );
  }

  // Wide screen chat interface - when hasSearched is true but no search results yet (research mode only)
  console.log('Rendering wide screen chat interface. hasSearched:', hasSearched, 'trials:', trials.length, 'papers:', papers.length, 'viewMode:', viewMode);
  if (viewMode === 'research') {
    return (
      <DashboardLayout currentProjectId={currentProjectId}>
        <ResearchChatView
        chatHistory={chatHistory}
        selectedPapers={selectedPapers}
        selectedPressReleases={selectedPressReleases}
        selectedExtractions={selectedExtractions}
        showContextPanel={showContextPanel}
        onToggleContextPanel={handleToggleContextPanel}
        onRemovePaper={handleRemovePaperFromContext}
        onRemovePressRelease={handleRemovePressReleaseFromContext}
        onRemoveExtraction={handleRemoveExtractionFromContext}
        onClearContext={handleClearContext}
        handleSearchSuggestion={handleSearchSuggestion}
        onSendMessage={handleSendMessage}
        loading={loading}
      />
    </DashboardLayout>
    )
  }

  // Fallback: if no specific view mode matches, default to initial research view
  console.log('No matching view mode, defaulting to initial research view. viewMode:', viewMode);
  return (
    <DashboardLayout variant="initial" currentProjectId={currentProjectId}>
      <InitialResearchView
        selectedPapers={selectedPapers}
        selectedPressReleases={selectedPressReleases}
        showContextPanel={showContextPanel}
        onToggleContextPanel={handleToggleContextPanel}
        onRemovePaper={handleRemovePaperFromContext}
        onRemovePressRelease={handleRemovePressReleaseFromContext}
        onClearContext={handleClearContext}
        onSendMessage={handleSendMessage}
        loading={loading}
        hasSearched={hasSearched}
      />
    </DashboardLayout>
  )
}
