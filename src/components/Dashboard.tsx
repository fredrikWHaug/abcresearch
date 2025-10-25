import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { LogOut, Send, Menu, ArrowUp, Upload, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { MarketMap } from '@/components/MarketMap'
import { TrialsList } from '@/components/TrialsList'
import { SavedMaps } from '@/components/SavedMaps'
import { PapersDiscovery } from '@/components/PapersDiscovery'
import { DrugsList } from '@/components/DrugsList'
import { DrugDetail } from '@/components/DrugDetail'
import { DrugDetailModal } from '@/components/DrugDetailModal'
import { GatherSearchResultsService } from '@/services/gatherSearchResults'
import type { PubMedArticle } from '@/types/papers'
import { MarketMapService, type SavedMarketMap } from '@/services/marketMapService'
import { PDFExtractionService, type ExtractionResult } from '@/services/pdfExtractionService'
import { DrugGroupingService, type DrugGroup } from '@/services/drugGroupingService'
import { ExtractDrugNamesService } from '@/services/extractDrugNames'
import { pubmedAPI } from '@/services/pubmedAPI'
import { supabase } from '@/lib/supabase'
import type { ClinicalTrial } from '@/types/trials'
import type { SlideData } from '@/services/slideAPI'

interface DashboardProps {
  initialShowSavedMaps?: boolean;
}

export function Dashboard({ initialShowSavedMaps = false }: DashboardProps) {
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

  // PDF processing functions
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setPdfProcessingResult(null);
    } else {
      alert('Please select a valid PDF file.');
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setIsProcessingPDF(true);
    setPdfProcessingResult(null);

    try {
      const result = await PDFExtractionService.extractTablesFromPDF(selectedFile);
      setPdfProcessingResult(result);
    } catch (error) {
      console.error('PDF processing error:', error);
      setPdfProcessingResult({
        success: false,
        tables: [],
        error: 'An unexpected error occurred while processing the PDF.'
      });
    } finally {
      setIsProcessingPDF(false);
    }
  }

  const handleDownloadExcel = () => {
    if (pdfProcessingResult?.excelBlob) {
      const filename = `extracted_tables_${new Date().toISOString().split('T')[0]}.xlsx`;
      PDFExtractionService.downloadExcelFile(pdfProcessingResult.excelBlob, filename);
    }
  }

  const handleResetUpload = () => {
    setSelectedFile(null);
    setPdfProcessingResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  const handleLoadSavedMap = (savedMap: SavedMarketMap) => {
    console.log('Loading saved map:', savedMap);
    console.log('Chat history from saved map:', savedMap.chat_history);
    console.log('Papers data from saved map:', savedMap.papers_data);
    
    // COMPLETELY REPLACE all current state with the loaded project's state
    setCurrentProjectId(savedMap.id);
    setTrials(savedMap.trials_data);
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
    
    // Restore papers data (replace current papers completely)
    if (savedMap.papers_data && Array.isArray(savedMap.papers_data) && savedMap.papers_data.length > 0) {
      console.log('Setting papers data:', savedMap.papers_data);
      setPapers(savedMap.papers_data);
    } else {
      console.log('No papers data to restore - clearing current papers');
      setPapers([]); // Clear current papers
    }
    
    // Clear any errors
    setSlideError(null);
    setSlideData(savedMap.slide_data); // Restore the saved slide data
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
  const [chatHistory, setChatHistory] = useState<Array<{type: 'user' | 'system', message: string, searchSuggestions?: Array<{id: string, label: string, query: string, description?: string}>}>>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [papers, setPapers] = useState<PubMedArticle[]>([])
  const [papersLoading, setPapersLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'projects' | 'research' | 'marketmap' | 'savedmaps' | 'dataextraction'>(initialShowSavedMaps ? 'savedmaps' : 'research')
  const [researchTab, setResearchTab] = useState<'trials' | 'papers'>('papers')
  const [slideData, setSlideData] = useState<SlideData | null>(null)
  const [generatingSlide, setGeneratingSlide] = useState(false)
  const [slideError, setSlideError] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null)
  
  // Drug grouping state
  const [drugGroups, setDrugGroups] = useState<DrugGroup[]>([])
  const [selectedDrug, setSelectedDrug] = useState<DrugGroup | null>(null)
  const [showDrugModal, setShowDrugModal] = useState(false)
  
  // Two-stage search state
  const [extractingDrugs, setExtractingDrugs] = useState(false)
  const [searchProgress, setSearchProgress] = useState({ current: 0, total: 0 })
  const [initialSearchQueries, setInitialSearchQueries] = useState<{
    originalQuery: string;
    clinicalTrialsQuery: string;
    pubmedQuery: string;
  } | null>(null)
  
  // PDF processing state
  const [isProcessingPDF, setIsProcessingPDF] = useState(false)
  const [pdfProcessingResult, setPdfProcessingResult] = useState<ExtractionResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMenuOpen) {
        const target = event.target as Element;
        if (!target.closest('.menu-container')) {
          setIsMenuOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

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
    setMessage('');
    setHasSearched(true); // Switch to wide screen chat interface after first message
    
    // Add user message to chat history
    setChatHistory(prev => [...prev, { type: 'user', message: userMessage }]);
    
    try {
      setLoading(true);
      
      console.log('Sending request to generate-response API with query:', userMessage);
      
      // First, get intent classification and response
      const response = await fetch('/api/generate-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userQuery: userMessage
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
   * Search for clinical trials and papers for a specific drug
   * Enhanced with original query context for better results
   */
  const searchForDrug = async (drugName: string, originalQuery: string): Promise<{ 
    trials: ClinicalTrial[], 
    papers: PubMedArticle[]
  }> => {
    try {
      // Include original query context for more targeted results
      const clinicalTrialsQuery = `${drugName} ${originalQuery}`;
      const pubmedQuery = `${drugName} AND ${originalQuery} AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])`;
      
      // Search clinical trials for this drug
      const trialsResponse = await fetch('/api/search-clinical-trials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: clinicalTrialsQuery,
        })
      });
      
      if (!trialsResponse.ok) {
        console.error('Error fetching trials for drug:', drugName);
        return { 
          trials: [], 
          papers: []
        };
      }
      
      const trialsData = await trialsResponse.json();
      const drugTrials = trialsData.trials || [];
      
      // Search papers for this drug
      const drugPapers = await pubmedAPI.searchPapers({
        query: pubmedQuery,
        maxResults: 20
      });
      
      return { 
        trials: drugTrials, 
        papers: drugPapers
      };
    } catch (error) {
      console.error('Error searching for drug:', drugName, error);
      return { 
        trials: [], 
        papers: []
      };
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
      
      // Add Stage 1 loading message to chat
      setChatHistory(prev => [...prev, { 
        type: 'system' as const, 
        message: 'stage1_loading',
        searchSuggestions: []
      }]);
      
      // Perform initial search
      const initialResult = await GatherSearchResultsService.gatherSearchResults(suggestion.query);
      
      // Save the initial search queries for display
      setInitialSearchQueries({
        originalQuery: suggestion.query,
        clinicalTrialsQuery: suggestion.query,
        pubmedQuery: `${suggestion.query} AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])`
      });
      
      // Extract unique drug names from the results
      const drugExtractionResult = await ExtractDrugNamesService.extractFromSearchResults(
        initialResult.trials,
        initialResult.papers
      );
      
      const uniqueDrugNames = drugExtractionResult.uniqueDrugNames;
      console.log(`Stage 1 complete: Found ${uniqueDrugNames.length} unique drugs:`, uniqueDrugNames);
      
      // Update chat with Stage 1 completion (remove loading message and add completion message)
      setChatHistory(prev => {
        const filtered = prev.filter(item => item.message !== 'stage1_loading');
        return [...filtered, { 
          type: 'system' as const, 
          message: `Found ${uniqueDrugNames.length} unique drugs from initial search. Now searching for comprehensive data on each drug...`,
          searchSuggestions: []
        }];
      });
      
      // Stage 2: Search for each drug specifically
      console.log('Stage 2: Searching for each drug specifically...');
      setExtractingDrugs(false);
      setSearchProgress({ current: 0, total: uniqueDrugNames.length });
      
      // Initialize drug groups array to show results as they come in
      const allDrugGroups: DrugGroup[] = [];
      
      // Search for each drug one by one and update results progressively
      for (let i = 0; i < uniqueDrugNames.length; i++) {
        const drugName = uniqueDrugNames[i];
        console.log(`Searching for drug ${i + 1}/${uniqueDrugNames.length}: ${drugName}`);
        
        // Include original query context for more targeted results
        const drugResults = await searchForDrug(drugName, suggestion.query);
        
        // Create a drug group for this drug
        const drugGroup: DrugGroup = {
          drugName: drugName,
          normalizedName: drugName.toLowerCase(),
          papers: drugResults.papers,
          trials: drugResults.trials,
          totalResults: drugResults.papers.length + drugResults.trials.length
        };
        
        allDrugGroups.push(drugGroup);
        
        // Update state immediately to show this drug's results
        setDrugGroups([...allDrugGroups].sort((a, b) => b.totalResults - a.totalResults));
        setSearchProgress({ current: i + 1, total: uniqueDrugNames.length });
        
        console.log(`Found ${drugGroup.totalResults} results for ${drugName}`);
        
        // Small delay to avoid overwhelming APIs and make progressive UI visible
        if (i < uniqueDrugNames.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Calculate total stats
      const totalTrials = allDrugGroups.reduce((sum, g) => sum + g.trials.length, 0);
      const totalPapers = allDrugGroups.reduce((sum, g) => sum + g.papers.length, 0);
      
      // Also update the global trials and papers arrays for MarketMap
      const allTrials = allDrugGroups.flatMap(g => g.trials);
      const allPapers = allDrugGroups.flatMap(g => g.papers);
      
      // Deduplicate trials and papers
      const uniqueTrials = Array.from(new Map(allTrials.map(t => [t.nctId, t])).values());
      const uniquePapers = Array.from(new Map(allPapers.map(p => [p.pmid, p])).values());
      
      setTrials(uniqueTrials);
      setPapers(uniquePapers);
      
      // Add final message to chat
      setChatHistory(prev => [...prev, { 
        type: 'system' as const, 
        message: `Search complete! Found ${allDrugGroups.length} drugs with ${totalTrials} clinical trials and ${totalPapers} research papers in total. Results are displayed on the right.`,
        searchSuggestions: []
      }]);
      
    } catch (error) {
      console.error('Error executing search suggestion:', error);
      setChatHistory(prev => [...prev, { 
        type: 'system' as const, 
        message: 'Sorry, there was an error conducting the search. Please try again.',
        searchSuggestions: []
      }]);
      setExtractingDrugs(false);
      setHasSearched(false);
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
      {/* Left Side - Hamburger Menu (only for authenticated users) + Guest Banner */}
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
      {(hasSearched || viewMode === 'savedmaps' || viewMode === 'dataextraction' || viewMode === 'projects') && (
        <div 
          className="absolute z-20"
          style={{ left: '50%', transform: 'translateX(-50%)' }}
        >
          <div className="flex rounded-lg bg-gray-100 p-1 w-[45rem]">
            <button
              onClick={() => setViewMode('projects')}
              className={`py-2 px-4 rounded-md text-sm font-medium transition-colors flex-1 text-center whitespace-nowrap ${
                viewMode === 'projects'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Projects
            </button>
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

  if (!hasSearched && viewMode !== 'savedmaps' && viewMode !== 'dataextraction') {
    // Initial centered search bar layout (skip if showing saved maps)
    console.log('Rendering initial centered search. hasSearched:', hasSearched, 'viewMode:', viewMode);
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-2xl px-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-gray-800 mb-2">Welcome back</h1>
          </div>
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

  // Show projects view
  if (viewMode === 'projects') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <Header onStartNewProject={handleStartNewProject} currentProjectId={currentProjectId} />
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-7xl mx-auto p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Projects</h1>
            <p className="text-gray-600">Projects view coming soon...</p>
          </div>
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


  // Data Extraction mode
  if (viewMode === 'dataextraction') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <Header onStartNewProject={handleStartNewProject} currentProjectId={currentProjectId} />
        
        {/* Data Extraction Content */}
        <div className="flex-1 overflow-hidden bg-gray-50 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Data Extraction</h2>
              <p className="text-gray-600">Upload a PDF document to extract tables and export to Excel</p>
            </div>
            
            {/* Upload Area */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              {!selectedFile ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-gray-800 transition-colors cursor-pointer group">
                  <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-gray-200 transition-colors">
                    <Upload className="w-8 h-8 text-gray-800" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload PDF Document</h3>
                  <p className="text-gray-600 mb-4">Drag and drop your PDF file here, or click to browse</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </button>
                  <p className="text-xs text-gray-500 mt-3">Supports PDF files up to 10MB</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Selected File Info */}
                  <div className="bg-gray-50 rounded-lg p-4 border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                          <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{selectedFile.name}</p>
                          <p className="text-sm text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button
                        onClick={handleResetUpload}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Processing State */}
                  {isProcessingPDF && (
                    <div className="bg-blue-50 rounded-lg p-6 text-center">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">Processing PDF...</h3>
                      <p className="text-blue-700">Extracting tables from your document. This may take a moment.</p>
                    </div>
                  )}

                  {/* Results */}
                  {pdfProcessingResult && (
                    <div className="space-y-4">
                      {pdfProcessingResult.success ? (
                        <div className="bg-green-50 rounded-lg p-6">
                          <div className="flex items-center mb-3">
                            <CheckCircle className="w-6 h-6 text-green-600 mr-2" />
                            <h3 className="text-lg font-semibold text-green-900">Extraction Successful!</h3>
                          </div>
                          <p className="text-green-700 mb-4">
                            Found {pdfProcessingResult.tables.length} table{pdfProcessingResult.tables.length !== 1 ? 's' : ''} in your PDF.
                          </p>
                          <button
                            onClick={handleDownloadExcel}
                            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download Excel File
                          </button>
                        </div>
                      ) : (
                        <div className="bg-red-50 rounded-lg p-6">
                          <div className="flex items-center mb-3">
                            <AlertCircle className="w-6 h-6 text-red-600 mr-2" />
                            <h3 className="text-lg font-semibold text-red-900">Extraction Failed</h3>
                          </div>
                          <p className="text-red-700">{pdfProcessingResult.error}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Process Button */}
                  {!isProcessingPDF && !pdfProcessingResult && (
                    <div className="text-center">
                      <button
                        onClick={handleFileUpload}
                        className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        <Upload className="w-5 h-5 mr-2" />
                        Extract Tables
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Research mode - split view layout (only when hasSearched is true and we have search results)
  console.log('Checking split screen condition. hasSearched:', hasSearched, 'trials:', trials.length, 'papers:', papers.length);
  if (hasSearched && (drugGroups.length > 0 || searchProgress.total > 0 || extractingDrugs)) {
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
                    {/* Special handling for Stage 1 loading */}
                    {item.message === 'stage1_loading' ? (
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">Stage 1: Extracting Drug Names</div>
                          <div className="text-gray-600 mt-1">Analyzing initial search results to identify all unique drugs...</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm leading-relaxed">
                        {item.message}
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
            />
          ) : (
            <DrugsList
              drugGroups={drugGroups}
              loading={searchProgress.total > 0 && searchProgress.current < searchProgress.total}
              query={lastQuery}
              onDrugClick={(drugGroup) => setSelectedDrug(drugGroup)}
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
              <div className="text-sm leading-relaxed">
                {item.message}
              </div>
              
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
            </div>
          ))}
        </div>

        {/* Message Input */}
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
  )
}
