import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LogOut, Menu, ArrowUp } from 'lucide-react'
import { MarketMap } from '@/components/MarketMap'
import { SavedMaps } from '@/components/SavedMaps'
import { DrugsList } from '@/components/DrugsList'
import { DrugDetail } from '@/components/DrugDetail'
import { DrugDetailModal } from '@/components/DrugDetailModal'
import { AssetDevelopmentPipeline } from '@/components/AssetDevelopmentPipeline'
import { PDFExtraction } from '@/components/PDFExtraction'
import { RealtimeFeed } from '@/components/RealtimeFeed'
import { GatherSearchResultsService } from '@/services/gatherSearchResults'
import type { PubMedArticle } from '@/types/papers'
import type { SavedMarketMap } from '@/services/marketMapService'
import type { DrugGroup } from '@/services/drugGroupingService'
import { ExtractDrugNamesService } from '@/services/extractDrugNames'
import type { ClinicalTrial } from '@/types/trials'
import type { SlideData } from '@/services/slideAPI'
import type { PressRelease } from '@/types/press-releases'
import type { IRDeck } from '@/types/ir-decks'

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

  const handleStartNewProject = () => {
    console.log('Starting new project - clearing current session');
    clearCurrentSession();
  }

  const [message, setMessage] = useState('')
  const [trials, setTrials] = useState<ClinicalTrial[]>([])
  const [loading, setLoading] = useState(false)
  const [lastQuery, setLastQuery] = useState('')
  const [chatHistory, setChatHistory] = useState<Array<{
    type: 'user' | 'system',
    message: string,
    searchSuggestions?: Array<{id: string, label: string, query: string, description?: string}>,
    contextPapers?: PubMedArticle[],
    contextPressReleases?: PressRelease[]
  }>>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [papers, setPapers] = useState<PubMedArticle[]>([])
  const [, setPressReleases] = useState<PressRelease[]>([])
  const [, setIRDecks] = useState<IRDeck[]>([])
  const [, setPapersLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'research' | 'marketmap' | 'savedmaps' | 'pipeline' | 'dataextraction' | 'realtimefeed'>(initialShowSavedMaps ? 'savedmaps' : 'research')
  const [slideData, setSlideData] = useState<SlideData | null>(null)
  const [generatingSlide, setGeneratingSlide] = useState(false)
  const [slideError, setSlideError] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(projectId)
  const [currentProjectName, setCurrentProjectName] = useState<string>(projectName)
  const [showProjectsDropdown, setShowProjectsDropdown] = useState(false)
  const [userProjects, setUserProjects] = useState<Array<{id: number, name: string, description?: string}>>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  
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
      console.log('Project ID set:', projectId)
      
      // Load chat history for this project from database
      import('@/services/projectService').then(async ({ loadChatHistory }) => {
        try {
          const dbChat = await loadChatHistory(projectId)
          if (dbChat && dbChat.length > 0) {
            console.log('[Dashboard] 📥 Loaded', dbChat.length, 'messages from database on mount')
            setChatHistory([...dbChat])
            projectChatHistoryRef.current.set(projectId, [...dbChat])
          }
        } catch (error) {
          console.error('[Dashboard] Failed to load chat history on mount:', error)
        }
      })
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
    
    if (isProjectSwitch) {
      console.log('[Dashboard] ✅ Project switched from', previousProjectIdRef.current, 'to', currentProjectId)
      
      // FIRST: Save current chat to PREVIOUS project database immediately
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
      
      // THEN: Load chat history for new project from database
      console.log('[Dashboard] 📥 Loading chat history for project', currentProjectId, 'from database...')
      
      import('@/services/projectService').then(async ({ loadChatHistory }) => {
        try {
          const dbChat = await loadChatHistory(currentProjectId)
          
          if (dbChat && dbChat.length > 0) {
            console.log('[Dashboard] ✅ Loaded', dbChat.length, 'messages from database for project', currentProjectId)
            setChatHistory([...dbChat])
            projectChatHistoryRef.current.set(currentProjectId, [...dbChat])
          } else {
            // Check in-memory cache as fallback
            const cachedChat = projectChatHistoryRef.current.get(currentProjectId)
            if (cachedChat && cachedChat.length > 0) {
              console.log('[Dashboard] ✅ Loading', cachedChat.length, 'messages from cache for project', currentProjectId)
              setChatHistory([...cachedChat])
            } else {
              console.log('[Dashboard] ✅ No chat history for project', currentProjectId, ', starting fresh')
              setChatHistory([])
            }
          }
        } catch (error) {
          console.error('[Dashboard] Failed to load chat history:', error)
          setChatHistory([])
        }
      })
      
      // Clear search results when switching projects
      setTrials([])
      setPapers([])
      setPressReleases([])
      setLastQuery('')
      setMessage('')
      setDrugGroups([])
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

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = message.trim();
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
      setInitialSearchQueries({
        originalQuery: suggestion.query,
        strategies: initialResult.searchStrategies
      });
      
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
  const Header = ({ onStartNewProject, currentProjectId }: { onStartNewProject?: () => void, currentProjectId?: number | null } = {}) => (
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
      {(hasSearched || viewMode === 'savedmaps' || viewMode === 'pipeline' || viewMode === 'dataextraction' || viewMode === 'realtimefeed') && (
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
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title={currentProjectName || 'Projects'}
              >
                <span className="truncate">
                  {currentProjectName || 'Projects'}
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
              onClick={() => setViewMode('savedmaps')}
              className={`py-2 px-4 rounded-md text-sm font-medium transition-colors flex-1 text-center whitespace-nowrap ${
                viewMode === 'savedmaps'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Saved Maps
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
      
      {/* Right Side - New Project Button */}
      {currentProjectId && onStartNewProject && (
        <div className="absolute right-6 top-1/2 transform -translate-y-1/2">
          <button
            onClick={onStartNewProject}
            className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-900 transition-colors"
          >
            New Project
          </button>
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

  if (!hasSearched && viewMode !== 'savedmaps' && viewMode !== 'pipeline' && viewMode !== 'realtimefeed') {
    // Initial centered search bar layout (skip if showing saved maps)
    console.log('Rendering initial centered search. hasSearched:', hasSearched, 'viewMode:', viewMode);
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-2xl px-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-gray-800 mb-2">Welcome back</h1>
          </div>
          
          {/* Context Display (Papers + Press Releases) */}
          {(selectedPapers.length > 0 || selectedPressReleases.length > 0) && (
            <div className="mb-3 flex justify-center">
              {(selectedPapers.length + selectedPressReleases.length) <= 2 ? (
                // Show individual pills for 1-2 papers
                <div className="flex flex-wrap gap-2 justify-center">
                  {selectedPapers.map((paper) => (
                    <div
                      key={paper.pmid}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-sm"
                    >
                      <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-blue-900 font-medium line-clamp-1 max-w-[200px]" title={paper.title}>
                        {paper.title}
                      </span>
                      <button
                        onClick={() => handleRemovePaperFromContext(paper.pmid)}
                        className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
                        title="Remove from context"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {selectedPressReleases.map((pr) => (
                    <div
                      key={pr.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-md text-sm"
                    >
                      <svg className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                      <span className="text-purple-900 font-medium line-clamp-1 max-w-[200px]" title={pr.title}>
                        {pr.title}
                      </span>
                      <button
                        onClick={() => handleRemovePressReleaseFromContext(pr.id)}
                        className="flex-shrink-0 text-purple-400 hover:text-purple-600 transition-colors"
                        title="Remove from context"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                // Show compact button for 3+ items
                <div className="relative context-panel-container">
                  <button
                    onClick={() => setShowContextPanel(!showContextPanel)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm font-medium text-blue-900">
                      Context ({selectedPapers.length + selectedPressReleases.length})
                    </span>
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  
                  {/* Context Panel Dropup */}
                  {showContextPanel && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 w-96 max-h-96 overflow-y-auto z-50">
                      <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">AI Context</h3>
                        <button
                          onClick={handleClearContext}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="py-2">
                        {selectedPapers.map((paper) => (
                          <div
                            key={paper.pmid}
                            className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 line-clamp-2">
                                  {paper.title}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {paper.journal} • {paper.publicationDate}
                                </p>
                              </div>
                              <button
                                onClick={() => handleRemovePaperFromContext(paper.pmid)}
                                className="flex-shrink-0 text-gray-400 hover:text-red-600 transition-colors"
                                title="Remove from context"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                        {selectedPressReleases.map((pr) => (
                          <div
                            key={pr.id}
                            className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 bg-purple-50/30"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 line-clamp-2">
                                  {pr.title}
                                </p>
                                <p className="text-xs text-purple-600 mt-1">
                                  Press Release • {pr.releaseDate}
                                </p>
                              </div>
                              <button
                                onClick={() => handleRemovePressReleaseFromContext(pr.id)}
                                className="flex-shrink-0 text-gray-400 hover:text-red-600 transition-colors"
                                title="Remove from context"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <div className="relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={hasSearched ? "Respond to ABCresearch's agent..." : "How can I help you today?"}
              className="flex h-[60px] w-full rounded-md border border-gray-300 bg-white pl-4 pr-16 py-2 text-lg ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
              autoFocus
            />
            <button
              onClick={handleSendMessage}
              disabled={!message.trim() || loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <ArrowUp className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {/* Header with centered buttons */}
        <div className="fixed top-0 left-0 right-0 z-50">
          <Header onStartNewProject={handleStartNewProject} currentProjectId={currentProjectId} />
        </div>
      </div>
    );
  }


  // Show saved maps view
  if (viewMode === 'savedmaps') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <Header onStartNewProject={handleStartNewProject} currentProjectId={currentProjectId} />
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <SavedMaps 
            onLoadMap={handleLoadSavedMap}
            onDeleteMap={handleDeleteSavedMap}
            currentProjectId={currentProjectId}
          />
        </div>
      </div>
    );
  }

  // After search - conditional layout based on view mode
  if (viewMode === 'marketmap') {
    // Full screen market map view
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <Header onStartNewProject={handleStartNewProject} currentProjectId={currentProjectId} />
        
        {/* Full Screen Market Map */}
        <div className="flex-1 overflow-hidden bg-gray-50">
          <MarketMap 
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
            onSaveSuccess={() => {
              console.log('Market map saved successfully!');
              // If we're viewing saved maps, we could refresh the list here
              // For now, just show a success message
            }}
            onNavigateToResearch={() => setViewMode('research')}
          />
        </div>
      </div>
    );
  }


  // Asset Development Pipeline mode
  if (viewMode === 'pipeline') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <Header onStartNewProject={handleStartNewProject} currentProjectId={currentProjectId} />
        
        {/* Asset Development Pipeline Content */}
        <div className="flex-1 overflow-hidden">
          <AssetDevelopmentPipeline 
            trials={trials} 
            drugGroups={drugGroups}
            query={lastQuery}
            onAddPaperToContext={handleAddPaperToContext}
            isPaperInContext={isPaperInContext}
          />
        </div>
      </div>
    );
  }

  // Data Extraction mode
  if (viewMode === 'dataextraction') {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <Header onStartNewProject={handleStartNewProject} currentProjectId={currentProjectId} />
        
        {/* PDF Data Extraction Content */}
        <div className="flex-1 overflow-y-auto">
          <PDFExtraction />
        </div>
      </div>
    );
  }


  // Realtime Feed mode
  if (viewMode === 'realtimefeed') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <Header onStartNewProject={handleStartNewProject} currentProjectId={currentProjectId} />
        
        {/* Realtime Feed Content */}
        <div className="flex-1 overflow-y-auto">
          <RealtimeFeed />
        </div>
      </div>
    );
  }

  // Research mode - split view layout (only when hasSearched is true and we have search results)
  console.log('Checking split screen condition. hasSearched:', hasSearched, 'trials:', trials.length, 'papers:', papers.length);
  if (hasSearched && (drugGroups.length > 0 || searchProgress.total > 0)) {
    console.log('Rendering split screen');
    return (
    <div className="h-screen flex flex-col relative">
      <Header onStartNewProject={handleStartNewProject} currentProjectId={currentProjectId} />
      
      {/* Vertical separator line - spans from header to bottom with precise centering */}
      <div 
        className="absolute w-px h-full bg-gray-200 z-10 top-0 pointer-events-none"
        style={{ left: '50%', transform: 'translateX(-0.5px)' }}
      ></div>

      {/* Split View Content */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Half - Chat Interface */}
        <div className="w-1/2 bg-background flex flex-col">
          {/* Chat Messages Area */}
          <div className="flex-1 p-6 overflow-y-auto min-h-0 max-h-full">
            <div className="max-w-2xl mx-auto space-y-4">
              {chatHistory.map((item, index) => (
                <div
                  key={index}
                  className={`flex ${item.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-4 rounded-lg border ${
                      item.type === 'user' 
                        ? 'bg-gray-800 text-white border-gray-700' 
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    {/* Special handling for progress messages */}
                    {item.message.startsWith('progress:') ? (
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{item.message.replace('progress:', '')}</div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm leading-relaxed">
                          {item.message}
                        </div>
                        
                        {/* Context Indicators */}
                        {((item.contextPapers && item.contextPapers.length > 0) || (item.contextPressReleases && item.contextPressReleases.length > 0)) && (
                          <div className="mt-2 space-y-2">
                            {/* Context Papers */}
                            {item.contextPapers && item.contextPapers.length > 0 && (
                              <details className="cursor-pointer">
                                <summary className={`text-xs font-medium inline-flex items-center gap-1 px-2 py-1 rounded ${
                                  item.type === 'user'
                                    ? 'bg-blue-700 text-blue-100 hover:bg-blue-600'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }`}>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Papers ({item.contextPapers.length})
                                </summary>
                                <div className="mt-2 space-y-1">
                                  {item.contextPapers.map((paper) => (
                                    <div
                                      key={paper.pmid}
                                      className={`text-xs p-2 rounded ${
                                        item.type === 'user'
                                          ? 'bg-gray-700 text-gray-300'
                                          : 'bg-white border border-gray-200'
                                      }`}
                                    >
                                      <div className="font-medium line-clamp-2">{paper.title}</div>
                                      <div className={`text-xs mt-1 ${
                                        item.type === 'user' ? 'text-gray-400' : 'text-gray-500'
                                      }`}>
                                        {paper.journal} • {paper.publicationDate}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}

                            {/* Context Press Releases */}
                            {item.contextPressReleases && item.contextPressReleases.length > 0 && (
                              <details className="cursor-pointer">
                                <summary className={`text-xs font-medium inline-flex items-center gap-1 px-2 py-1 rounded ${
                                  item.type === 'user'
                                    ? 'bg-purple-700 text-purple-100 hover:bg-purple-600'
                                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                }`}>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                                  </svg>
                                  Press Releases ({item.contextPressReleases.length})
                                </summary>
                                <div className="mt-2 space-y-1">
                                  {item.contextPressReleases.map((pr) => (
                                    <div
                                      key={pr.id}
                                      className={`text-xs p-2 rounded ${
                                        item.type === 'user'
                                          ? 'bg-gray-700 text-gray-300'
                                          : 'bg-white border border-purple-200'
                                      }`}
                                    >
                                      <div className="font-medium line-clamp-2">{pr.title}</div>
                                      <div className={`text-xs mt-1 ${
                                        item.type === 'user' ? 'text-gray-400' : 'text-purple-600'
                                      }`}>
                                        {pr.company} • {pr.releaseDate}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Search Suggestions */}
                    {item.searchSuggestions && item.searchSuggestions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {item.searchSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            onClick={() => handleSearchSuggestion(suggestion)}
                            className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="font-medium text-blue-900">{suggestion.label}</span>
                            </div>
                            {suggestion.description && (
                              <div className="text-xs text-blue-700 mt-1 ml-4">
                                {suggestion.description}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Stage 2 Progress Indicator */}
              {searchProgress.total > 0 && searchProgress.current < searchProgress.total && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-4 rounded-lg border bg-blue-50 border-blue-200">
                    <div className="text-sm text-blue-900 mb-2">
                      Stage 2: Searching for drug {searchProgress.current + 1} of {searchProgress.total}...
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(searchProgress.current / searchProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input Area - Fixed at bottom */}
          <div className="p-6 border-t bg-background flex-shrink-0">
            <div className="max-w-2xl mx-auto">
              {/* Context Display (Papers + Press Releases) */}
              {(selectedPapers.length > 0 || selectedPressReleases.length > 0) && (
                <div className="mb-3">
                  {(selectedPapers.length + selectedPressReleases.length) <= 2 ? (
                    // Show individual pills for 1-2 items
                    <div className="flex flex-wrap gap-2">
                      {selectedPapers.map((paper) => (
                        <div
                          key={paper.pmid}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-sm"
                        >
                          <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-blue-900 font-medium line-clamp-1 max-w-[200px]" title={paper.title}>
                            {paper.title}
                          </span>
                          <button
                            onClick={() => handleRemovePaperFromContext(paper.pmid)}
                            className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
                            title="Remove from context"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {selectedPressReleases.map((pr) => (
                        <div
                          key={pr.id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-md text-sm"
                        >
                          <svg className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                          </svg>
                          <span className="text-purple-900 font-medium line-clamp-1 max-w-[200px]" title={pr.title}>
                            {pr.title}
                          </span>
                          <button
                            onClick={() => handleRemovePressReleaseFromContext(pr.id)}
                            className="flex-shrink-0 text-purple-400 hover:text-purple-600 transition-colors"
                            title="Remove from context"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Show compact button for 3+ items
                    <div className="relative">
                      <button
                        onClick={() => setShowContextPanel(!showContextPanel)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm font-medium text-blue-900">
                          Context ({selectedPapers.length + selectedPressReleases.length})
                        </span>
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>

                      {/* Context Panel Dropup */}
                      {showContextPanel && (
                        <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 w-96 max-h-96 overflow-y-auto z-50">
                          <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900">AI Context</h3>
                            <button
                              onClick={handleClearContext}
                              className="text-xs text-red-600 hover:text-red-700 font-medium"
                            >
                              Clear All
                            </button>
                          </div>
                          <div className="py-2">
                            {selectedPapers.map((paper) => (
                              <div
                                key={paper.pmid}
                                className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 line-clamp-2">
                                      {paper.title}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {paper.journal} • {paper.publicationDate}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleRemovePaperFromContext(paper.pmid)}
                                    className="flex-shrink-0 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Remove from context"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                            {selectedPressReleases.map((pr) => (
                              <div
                                key={pr.id}
                                className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 bg-purple-50/30"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 line-clamp-2">
                                      {pr.title}
                                    </p>
                                    <p className="text-xs text-purple-600 mt-1">
                                      {pr.company} • {pr.releaseDate}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleRemovePressReleaseFromContext(pr.id)}
                                    className="flex-shrink-0 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Remove from context"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <div className="relative">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={hasSearched ? "Respond to ABCresearch's agent..." : "How can I help you today?"}
                  className="flex h-[50px] w-full rounded-md border border-gray-300 bg-white pl-4 pr-12 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  <ArrowUp className="h-3 w-3 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Half - Drug-Centric View */}
        <div className="w-1/2 bg-gray-50 overflow-hidden">
          {selectedDrug ? (
            <DrugDetail
              drugGroup={selectedDrug}
              query={lastQuery}
              onBack={() => setSelectedDrug(null)}
              onExpandFullscreen={() => setShowDrugModal(true)}
              onAddPaperToContext={handleAddPaperToContext}
              isPaperInContext={isPaperInContext}
              onAddPressReleaseToContext={handleAddPressReleaseToContext}
              isPressReleaseInContext={isPressReleaseInContext}
            />
          ) : (
            <DrugsList
              drugGroups={drugGroups}
              loading={searchProgress.total > 0 && searchProgress.current < searchProgress.total}
              query={lastQuery}
              onDrugClick={(drugGroup) => setSelectedDrug(drugGroup)}
              onDrugSpecificSearch={handleDrugSpecificSearch}
              initialSearchQueries={initialSearchQueries}
            />
          )}
        </div>
      </div>

      {/* Fullscreen Drug Modal */}
      {showDrugModal && selectedDrug && (
        <DrugDetailModal
          drugGroup={selectedDrug}
          query={lastQuery}
          onClose={() => {
            setShowDrugModal(false);
          }}
          onAddPaperToContext={handleAddPaperToContext}
          isPaperInContext={isPaperInContext}
          onAddPressReleaseToContext={handleAddPressReleaseToContext}
          isPressReleaseInContext={isPressReleaseInContext}
        />
      )}
    </div>
  )
  }

  // Wide screen chat interface - when hasSearched is true but no search results yet
  console.log('Rendering wide screen chat interface. hasSearched:', hasSearched, 'trials:', trials.length, 'papers:', papers.length);
  return (
    <div className="h-screen flex flex-col">
      <Header />
      
      {/* Wide Screen Chat Interface */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-6 py-8">
        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto mb-6">
          {chatHistory.map((item, index) => (
            <div key={index} className={`mb-4 p-4 rounded-lg border ${
              item.type === 'user' 
                ? 'bg-gray-800 text-white border-gray-700' 
                : 'bg-gray-50 text-gray-700 border-gray-200'
            }`}>
              {/* Special handling for progress messages */}
              {item.message.startsWith('progress:') ? (
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{item.message.replace('progress:', '')}</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-sm leading-relaxed">
                    {item.message}
                  </div>
                  
                  {/* Context Indicators */}
                  {((item.contextPapers && item.contextPapers.length > 0) || (item.contextPressReleases && item.contextPressReleases.length > 0)) && (
                    <div className="mt-2 space-y-2">
                      {/* Context Papers */}
                      {item.contextPapers && item.contextPapers.length > 0 && (
                        <details className="cursor-pointer">
                          <summary className={`text-xs font-medium inline-flex items-center gap-1 px-2 py-1 rounded ${
                            item.type === 'user'
                              ? 'bg-blue-700 text-blue-100 hover:bg-blue-600'
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Papers ({item.contextPapers.length})
                          </summary>
                          <div className="mt-2 space-y-1">
                            {item.contextPapers.map((paper) => (
                              <div
                                key={paper.pmid}
                                className={`text-xs p-2 rounded ${
                                  item.type === 'user'
                                    ? 'bg-gray-700 text-gray-300'
                                    : 'bg-white border border-gray-200'
                                }`}
                              >
                                <div className="font-medium line-clamp-2">{paper.title}</div>
                                <div className={`text-xs mt-1 ${
                                  item.type === 'user' ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                  {paper.journal} • {paper.publicationDate}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Context Press Releases */}
                      {item.contextPressReleases && item.contextPressReleases.length > 0 && (
                        <details className="cursor-pointer">
                          <summary className={`text-xs font-medium inline-flex items-center gap-1 px-2 py-1 rounded ${
                            item.type === 'user'
                              ? 'bg-purple-700 text-purple-100 hover:bg-purple-600'
                              : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          }`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                            </svg>
                            Press Releases ({item.contextPressReleases.length})
                          </summary>
                          <div className="mt-2 space-y-1">
                            {item.contextPressReleases.map((pr) => (
                              <div
                                key={pr.id}
                                className={`text-xs p-2 rounded ${
                                  item.type === 'user'
                                    ? 'bg-gray-700 text-gray-300'
                                    : 'bg-white border border-purple-200'
                                }`}
                              >
                                <div className="font-medium line-clamp-2">{pr.title}</div>
                                <div className={`text-xs mt-1 ${
                                  item.type === 'user' ? 'text-gray-400' : 'text-purple-600'
                                }`}>
                                  {pr.company} • {pr.releaseDate}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                  
                  {/* Search Suggestions */}
                  {item.searchSuggestions && item.searchSuggestions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {item.searchSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          onClick={() => handleSearchSuggestion(suggestion)}
                          className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="font-medium text-blue-900">{suggestion.label}</span>
                          </div>
                          {suggestion.description && (
                            <p className="text-sm text-blue-700 mt-1">{suggestion.description}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div>
          {/* Context Display (Papers + Press Releases) */}
          {(selectedPapers.length > 0 || selectedPressReleases.length > 0) && (
            <div className="mb-3">
              {(selectedPapers.length + selectedPressReleases.length) <= 2 ? (
                // Show individual pills for 1-2 items
                <div className="flex flex-wrap gap-2">
                  {selectedPapers.map((paper) => (
                    <div
                      key={paper.pmid}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-sm"
                    >
                      <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-blue-900 font-medium line-clamp-1 max-w-[200px]" title={paper.title}>
                        {paper.title}
                      </span>
                      <button
                        onClick={() => handleRemovePaperFromContext(paper.pmid)}
                        className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
                        title="Remove from context"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {selectedPressReleases.map((pr) => (
                    <div
                      key={pr.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-md text-sm"
                    >
                      <svg className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                      <span className="text-purple-900 font-medium line-clamp-1 max-w-[200px]" title={pr.title}>
                        {pr.title}
                      </span>
                      <button
                        onClick={() => handleRemovePressReleaseFromContext(pr.id)}
                        className="flex-shrink-0 text-purple-400 hover:text-purple-600 transition-colors"
                        title="Remove from context"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                // Show compact button for 3+ items
                <div className="relative context-panel-container">
                  <button
                    onClick={() => setShowContextPanel(!showContextPanel)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm font-medium text-blue-900">
                      Context ({selectedPapers.length + selectedPressReleases.length})
                    </span>
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  
                  {/* Context Panel Dropup */}
                  {showContextPanel && (
                    <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 w-96 max-h-96 overflow-y-auto z-50">
                      <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">AI Context</h3>
                        <button
                          onClick={handleClearContext}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="py-2">
                        {selectedPapers.map((paper) => (
                          <div
                            key={paper.pmid}
                            className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 line-clamp-2">
                                  {paper.title}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {paper.journal} • {paper.publicationDate}
                                </p>
                              </div>
                              <button
                                onClick={() => handleRemovePaperFromContext(paper.pmid)}
                                className="flex-shrink-0 text-gray-400 hover:text-red-600 transition-colors"
                                title="Remove from context"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                        {selectedPressReleases.map((pr) => (
                          <div
                            key={pr.id}
                            className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 bg-purple-50/30"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 line-clamp-2">
                                  {pr.title}
                                </p>
                                <p className="text-xs text-purple-600 mt-1">
                                  Press Release • {pr.releaseDate}
                                </p>
                              </div>
                              <button
                                onClick={() => handleRemovePressReleaseFromContext(pr.id)}
                                className="flex-shrink-0 text-gray-400 hover:text-red-600 transition-colors"
                                title="Remove from context"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <div className="relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Respond to ABCresearch's agent..."
              className="flex h-[60px] w-full rounded-md border border-gray-300 bg-white pl-4 pr-16 py-2 text-lg ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
              autoFocus
            />
            <button
              onClick={handleSendMessage}
              disabled={!message.trim() || loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <ArrowUp className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
