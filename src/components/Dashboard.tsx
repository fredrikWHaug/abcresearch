/* eslint-disable */
import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LogOut, Menu } from 'lucide-react'
import { CreateProjectModal } from '@/components/CreateProjectModal'
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
}


export function Dashboard({ initialShowSavedMaps = false, projectName = '', projectId = null }: DashboardProps) {
  const { signOut, isGuest, exitGuestMode } = useAuth()
  
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
    setShowContextPanel(false);
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
  }

  const handleDeleteSavedMap = (_id: number) => {
    // If we're currently viewing the deleted map, clear the view
    if (currentProjectId === _id) {
      clearCurrentSession();
    }
  }

  const [message, setMessage] = useState('')
  const [trials, setTrials] = useState<ClinicalTrial[]>([])
  const [loading, setLoading] = useState(false)
  const [lastQuery, setLastQuery] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [papers, setPapers] = useState<PubMedArticle[]>([])
  const [, setPressReleases] = useState<PressRelease[]>([])
  const [, setIRDecks] = useState<IRDeck[]>([])
  const [, setPapersLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'research' | 'pipeline' | 'marketmap' | 'dataextraction' | 'realtimefeed'>(initialShowSavedMaps ? 'marketmap' : 'research')
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
      
      // Load chat history and search queries
      import('@/services/projectService').then(async ({ loadChatHistory, loadSearchQueries }) => {
        try {
          const [dbChat, searchQueries] = await Promise.all([
            loadChatHistory(currentProjectId),
            loadSearchQueries(currentProjectId)
          ])
          
          // Load search queries
          if (searchQueries) {
            console.log('[Dashboard] ✅ Loaded search queries for project', currentProjectId)
            setInitialSearchQueries(searchQueries)
          } else {
            setInitialSearchQueries(null)
          }
          
          // Load chat history
          if (dbChat && dbChat.length > 0) {
            console.log('[Dashboard] ✅ Loaded', dbChat.length, 'messages from database for project', currentProjectId)
            setChatHistory([...dbChat])
            projectChatHistoryRef.current.set(currentProjectId, [...dbChat])
            // Set hasSearched to true so the UI shows the research view with chat history
            setHasSearched(true)
            // Ensure we're in research view mode
            setViewMode('research')
          } else {
            // Check in-memory cache as fallback
            const cachedChat = projectChatHistoryRef.current.get(currentProjectId)
            if (cachedChat && cachedChat.length > 0) {
              console.log('[Dashboard] ✅ Loading', cachedChat.length, 'messages from cache for project', currentProjectId)
              setChatHistory([...cachedChat])
              // Set hasSearched to true so the UI shows the research view with chat history
              setHasSearched(true)
              // Ensure we're in research view mode
              setViewMode('research')
            } else {
              console.log('[Dashboard] ✅ No chat history for project', currentProjectId, ', starting fresh')
              setChatHistory([])
              setHasSearched(false)
              setViewMode('research')
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
      setMessage('')
      setSelectedDrug(null)
      setSelectedPapers([])
      setShowContextPanel(false)
    }
    
    // Update previous project ref
    previousProjectIdRef.current = currentProjectId
  }, [currentProjectId])
  
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
  const [showContextPanel, setShowContextPanel] = useState(false)

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

  const handleSendMessage = async (overrideMessage?: string) => {
    const rawMessage = overrideMessage ?? message;
    if (!rawMessage.trim()) return;

    const userMessage = rawMessage.trim();
    const messageContextPapers = [...selectedPapers]; // Snapshot current context
    const messageContextPressReleases = [...selectedPressReleases]; // Snapshot press releases context
    setMessage('');
    setHasSearched(true); // Switch to wide screen chat interface after first message

    // Add user message to chat history with context papers and press releases
    setChatHistory(prev => [...prev, {
      type: 'user',
      message: userMessage,
      contextPapers: messageContextPapers.length > 0 ? messageContextPapers : undefined,
      contextPressReleases: messageContextPressReleases.length > 0 ? messageContextPressReleases : undefined
    }]);

    try {
      setLoading(true);

      console.log('Sending request to generate-response API with query:', userMessage);
      console.log('Chat history being sent:', chatHistory.length, 'messages');
      console.log('Context papers:', selectedPapers.length, 'press releases:', selectedPressReleases.length);

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
          contextPressReleases: selectedPressReleases.length > 0 ? selectedPressReleases : undefined
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
      
      setChatHistory(prev => {
        const newHistory = [...prev, { 
          type: 'system' as const, 
          message: data.response,
          searchSuggestions: data.searchSuggestions || []
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
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
        pressReleases: [],
        irDecks: result.irDecks || [],
        totalResults: sortedPapers.length + sortedTrials.length + (result.irDecks?.length || 0)
      };
      
      // Update drugGroups to include this updated drug or add it if new
      setDrugGroups(prev => {
        const existing = prev.find(g => g.normalizedName === drugName.toLowerCase());
        if (existing) {
          // Update existing drug
          return prev.map(g => 
            g.normalizedName === drugName.toLowerCase() ? updatedDrugGroup : g
          ).sort((a, b) => b.totalResults - a.totalResults);
        } else {
          // Add new drug
          return [...prev, updatedDrugGroup].sort((a, b) => b.totalResults - a.totalResults);
        }
      });
      
      // Open the drug modal to show results
      setSelectedDrug(updatedDrugGroup);
      
      // Notify success (remove progress messages)
      setChatHistory(prev => {
        const filtered = prev.filter(item => !item.message.startsWith('progress:'));
        return [...filtered, {
          type: 'system' as const,
          message: `Found ${sortedTrials.length} trials and ${sortedPapers.length} papers for "${drugName}" (sorted by recency and size)`,
          searchSuggestions: []
        }];
      });
      
      console.log(`✅ Deep Dive complete: ${sortedTrials.length} trials, ${sortedPapers.length} papers`);
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
    <div className="h-16 bg-white border-b border-gray-200 z-50 flex items-center relative">
      {/* Left Side - Hamburger Menu (only for authenticated users) + Guest Banner + Context Indicator */}
      <div className="flex items-center gap-3 px-6">
        {/* Hamburger Menu - Only show for authenticated users */}
        {!isGuest && (
          <div className="relative menu-container">
            <button
              onClick={handleMenuToggle}
              className="p-3 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow border border-gray-200 hover:bg-gray-50"
              title="Menu"
            >
              <Menu className="h-5 w-5 text-gray-600 hover:text-gray-800" />
            </button>
            
            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute top-12 left-0 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[160px] z-50">
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                >
                  <LogOut className="h-4 w-4 text-gray-500" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Guest Mode Indicator */}
        <GuestModeIndicator />
      </div>
      
      {/* Toggle Buttons - Absolutely positioned center with equal widths */}
      {(currentProjectId || hasSearched || viewMode === 'pipeline' || viewMode === 'marketmap' || viewMode === 'dataextraction' || viewMode === 'realtimefeed') && (
        <div 
          className="absolute z-20"
          style={{ left: '50%', transform: 'translateX(-50%)' }}
        >
          <div className="flex rounded-lg bg-gray-100 p-1 w-[60rem]">
            <div className="relative flex-1 projects-dropdown-container">
              <button
                onClick={() => setShowProjectsDropdown(!showProjectsDropdown)}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-colors w-full text-center whitespace-nowrap overflow-hidden ${
                  showProjectsDropdown
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
                title={currentProjectName ? `Project: ${currentProjectName}` : 'Projects'}
              >
                <span className="truncate">
                  {currentProjectName ? `Project: ${currentProjectName}` : 'Projects'}
                </span>
              </button>
              
              {/* Projects Dropdown */}
              {showProjectsDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[250px] z-50">
                  <div className="px-4 py-2 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900 text-sm">Your Projects</h3>
                  </div>
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {loadingProjects ? (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">
                        Loading projects...
                      </div>
                    ) : userProjects.length > 0 ? (
                      userProjects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => {
                            setCurrentProjectId(project.id)
                            setCurrentProjectName(project.name)
                            setShowProjectsDropdown(false)
                            console.log('Switched to project:', project.name)
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                            project.id === currentProjectId ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              project.id === currentProjectId ? 'bg-blue-100' : 'bg-gray-100'
                            }`}>
                              <svg className={`w-4 h-4 ${
                                project.id === currentProjectId ? 'text-blue-600' : 'text-gray-600'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {project.name}
                              </p>
                              {project.id === currentProjectId && (
                                <p className="text-xs text-blue-600">
                                  Current project
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">
                        No projects yet
                      </div>
                    )}
                  </div>
                  
                  {/* Create New Project Button */}
                  <div className="border-t border-gray-200 pt-2">
                    <button
                      onClick={() => {
                        setShowCreateProjectModal(true)
                        setShowProjectsDropdown(false)
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-100">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-blue-600">
                            Create New Project
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setViewMode('research')}
              className={`py-2 px-4 rounded-md text-sm font-medium transition-colors flex-1 text-center whitespace-nowrap ${
                viewMode === 'research'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Research
            </button>
            <button
              onClick={() => setViewMode('pipeline')}
              className={`py-2 px-4 rounded-md text-sm font-medium transition-colors flex-1 text-center whitespace-nowrap ${
                viewMode === 'pipeline'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Asset Pipeline
            </button>
            <button
              onClick={() => setViewMode('marketmap')}
              className={`py-2 px-4 rounded-md text-sm font-medium transition-colors flex-1 text-center whitespace-nowrap ${
                viewMode === 'marketmap'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Market Map
            </button>
            <button
              onClick={() => setViewMode('dataextraction')}
              className={`py-2 px-4 rounded-md text-sm font-medium transition-colors flex-1 text-center whitespace-nowrap ${
                viewMode === 'dataextraction'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Data Extraction
            </button>
            <button
              onClick={() => setViewMode('realtimefeed')}
              className={`py-2 px-4 rounded-md text-sm font-medium transition-colors flex-1 text-center whitespace-nowrap ${
                viewMode === 'realtimefeed'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Realtime Feed
            </button>
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                  }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-700 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                <div className="font-medium text-amber-800">Guest Mode</div>
                <div className="text-amber-700 mt-1">Your data won't be saved. 
                  <button 
                    onClick={exitGuestMode}
                    className="underline hover:text-amber-900 ml-1"
                  >
                    Sign up to save
                  </button>
                </div>
              </div>
            )}
          </div>
      </div>
    );
  };

  // Create Project Modal Component (shared across all views)
  const ProjectModal = () => (
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
  );

  // Determine which view to show
  const showInitialSearch = !hasSearched && viewMode !== 'pipeline' && viewMode !== 'marketmap' && viewMode !== 'realtimefeed' && viewMode !== 'dataextraction';
  const showMarketMap = viewMode === 'marketmap';
  const showPipeline = viewMode === 'pipeline';
  const showDataExtraction = viewMode === 'dataextraction';
  const showRealtimeFeed = viewMode === 'realtimefeed';
  const showResearchSplit = hasSearched && (drugGroups.length > 0 || searchProgress.total > 0) && !showMarketMap && !showPipeline && !showDataExtraction && !showRealtimeFeed;
  const showResearchChat = !showInitialSearch && !showMarketMap && !showPipeline && !showDataExtraction && !showRealtimeFeed && !showResearchSplit;

  // Render all views but only show the active one
  // This prevents unmounting/remounting and preserves component state
  
  // Use inline layout structure to avoid recreating wrapper component
  const layoutContent = (
    <>
      {/* Initial Research View */}
      <div key="initial-research-view" className={showInitialSearch ? 'block h-full' : 'hidden'}>
        <InitialResearchView
          selectedPapers={selectedPapers}
          selectedPressReleases={selectedPressReleases}
          showContextPanel={showContextPanel}
          onToggleContextPanel={() => setShowContextPanel(prev => !prev)}
          onRemovePaper={handleRemovePaperFromContext}
          onRemovePressRelease={handleRemovePressReleaseFromContext}
          onClearContext={handleClearContext}
          message={message}
          onMessageChange={(value) => setMessage(value)}
          onSendMessage={handleSendMessage}
          onKeyPress={handleKeyPress}
          loading={loading}
          hasSearched={hasSearched}
        />
      </div>

      {/* Market Map View */}
      <div key="market-map-view" className={showMarketMap ? 'block h-full' : 'hidden'}>
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
          currentProjectId={currentProjectId}
          onNavigateToResearch={() => setViewMode('research')}
          onLoadMap={handleLoadSavedMap}
          onDeleteMap={handleDeleteSavedMap}
        />
      </div>

      {/* Pipeline View */}
      <div key="pipeline-view" className={showPipeline ? 'block h-full' : 'hidden'}>
        <PipelineView
          trials={trials} 
          drugGroups={drugGroups}
          query={lastQuery}
          onAddPaperToContext={handleAddPaperToContext}
          isPaperInContext={isPaperInContext}
          pipelineCandidates={pipelineCandidates}
          setPipelineCandidates={setPipelineCandidates}
        />
      </div>

      {/* Data Extraction View */}
      <div key="data-extraction-view" className={showDataExtraction ? 'block h-full' : 'hidden'}>
        <DataExtractionView isVisible={showDataExtraction} />
      </div>

      {/* Realtime Feed View */}
      <div key="realtime-feed-view" className={showRealtimeFeed ? 'block h-full' : 'hidden'}>
        <RealtimeFeedView isVisible={showRealtimeFeed} />
      </div>

      {/* Research Split View */}
      <div key="research-split-view" className={showResearchSplit ? 'block h-full' : 'hidden'}>
        <ResearchSplitView
          chatHistory={chatHistory}
          selectedPapers={selectedPapers}
          selectedPressReleases={selectedPressReleases}
          showContextPanel={showContextPanel}
          onToggleContextPanel={() => setShowContextPanel(prev => !prev)}
          onRemovePaper={handleRemovePaperFromContext}
          onRemovePressRelease={handleRemovePressReleaseFromContext}
          onClearContext={handleClearContext}
          onMessageChange={(value) => setMessage(value)}
          onSendMessage={handleSendMessage}
          onKeyPress={handleKeyPress}
          handleSearchSuggestion={handleSearchSuggestion}
          message={message}
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
      </div>

      {/* Research Chat View */}
      <div key="research-chat-view" className={showResearchChat ? 'block h-full' : 'hidden'}>
        <ResearchChatView
          chatHistory={chatHistory}
          selectedPapers={selectedPapers}
          selectedPressReleases={selectedPressReleases}
          showContextPanel={showContextPanel}
          onToggleContextPanel={() => setShowContextPanel(prev => !prev)}
          onRemovePaper={handleRemovePaperFromContext}
          onRemovePressRelease={handleRemovePressReleaseFromContext}
          onClearContext={handleClearContext}
          handleSearchSuggestion={handleSearchSuggestion}
          message={message}
          onMessageChange={(value) => setMessage(value)}
          onSendMessage={handleSendMessage}
          onKeyPress={handleKeyPress}
          loading={loading}
        />
      </div>
    </>
  );

  // Render with appropriate layout variant
  if (showInitialSearch) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="flex-1 overflow-auto flex items-center justify-center">
          {layoutContent}
        </div>
        <div className="fixed top-0 left-0 right-0 z-50">
          <Header currentProjectId={currentProjectId} />
        </div>
        <ProjectModal />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <Header currentProjectId={currentProjectId} />
      <div className="flex-1 min-h-0">
        {layoutContent}
      </div>
      <ProjectModal />
    </div>
  );
}
