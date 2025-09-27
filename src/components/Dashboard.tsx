import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { LogOut, Send, Menu, ArrowUp } from 'lucide-react'
import { MarketMap } from '@/components/MarketMap'
import { TrialsList } from '@/components/TrialsList'
import { SavedMaps } from '@/components/SavedMaps'
import { ClinicalTrialsAPI } from '@/services/clinicalTrialsAPI'
import { EnhancedSearchAPI } from '@/services/enhancedSearchAPI'
import { MarketMapService, type SavedMarketMap } from '@/services/marketMapService'
import type { ClinicalTrial } from '@/services/clinicalTrialsAPI'
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

  const handleLoadSavedMap = (savedMap: SavedMarketMap) => {
    // Load the saved map data
    setTrials(savedMap.trials_data);
    setSlideData(savedMap.slide_data);
    setLastQuery(savedMap.query);
    setHasSearched(true);
    setViewMode('marketmap');
    
    // Clear any errors
    setSlideError(null);
  }

  const handleDeleteSavedMap = (_id: number) => {
    // If we're currently viewing the deleted map, clear the view
    if (slideData && trials.length > 0) {
      // Check if this is the currently loaded map by comparing some key data
      // For now, we'll just clear the view if any map is deleted
      setTrials([]);
      setSlideData(null);
      setLastQuery('');
      setHasSearched(false);
      setViewMode('research');
    }
  }

  const [message, setMessage] = useState('')
  const [trials, setTrials] = useState<ClinicalTrial[]>([])
  const [loading, setLoading] = useState(false)
  const [lastQuery, setLastQuery] = useState('')
  const [chatHistory, setChatHistory] = useState<Array<{type: 'user' | 'system', message: string}>>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [viewMode, setViewMode] = useState<'research' | 'marketmap' | 'savedmaps'>(initialShowSavedMaps ? 'savedmaps' : 'research')
  const [slideData, setSlideData] = useState<SlideData | null>(null)
  const [generatingSlide, setGeneratingSlide] = useState(false)
  const [slideError, setSlideError] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

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

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    const userMessage = message.trim();
    setMessage('');
    setLastQuery(userMessage);
    setHasSearched(true);
    
    // Add user message to chat history
    setChatHistory(prev => [...prev, { type: 'user', message: userMessage }]);
    
    try {
      setLoading(true);
      
      // Reset slide data when performing a new search
      setSlideData(null);
      setSlideError(null);
      
      // Use enhanced search with AI-powered query expansion
      const result = await EnhancedSearchAPI.searchWithEnhancement(userMessage);
      
      setTrials(result.trials);
      
      // Generate a natural, informative response based on the results
      const responseMessage = generateSearchResponse(result, userMessage);
      
      // Add system response to chat history
      setChatHistory(prev => [...prev, { 
        type: 'system', 
        message: responseMessage
      }]);
      
    } catch (error) {
      console.error('Error fetching trials:', error);
      setChatHistory(prev => [...prev, { 
        type: 'system', 
        message: 'Sorry, there was an error fetching the clinical trials. Please try again.' 
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

  const generateSearchResponse = (result: any, userQuery: string): string => {
    const { trials, searchStrategies } = result;
    const totalTrials = trials.length;
    
    if (totalTrials === 0) {
      return `I couldn't find any clinical trials matching "${userQuery}". Try using different keywords or broader terms like "cancer", "diabetes", or "Phase 2 trials".`;
    }
    
    // Analyze the results
    const recruitingCount = trials.filter((t: any) => t.overallStatus === 'RECRUITING').length;
    const phase3Count = trials.filter((t: any) => t.phase?.some((p: string) => p.includes('3'))).length;
    const topSponsors = [...new Set(trials.map((t: any) => t.sponsors?.lead).filter(Boolean))].slice(0, 3);
    
    // Generate natural response
    let response = `Great! I found ${totalTrials} clinical trials for "${userQuery}". `;
    
    if (recruitingCount > 0) {
      response += `${recruitingCount} are currently recruiting participants. `;
    }
    
    if (phase3Count > 0) {
      response += `${phase3Count} are in Phase 3 (late-stage trials). `;
    }
    
    if (topSponsors.length > 0) {
      response += `Key sponsors include ${topSponsors.join(', ')}. `;
    }
    
    response += `The results are ranked by relevance and displayed in the Market Map. You can also view them in the Research tab.`;
    
    return response;
  }

  // Shared header component
  const Header = () => (
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
      {(hasSearched || viewMode === 'savedmaps') && (
        <div 
          className="absolute z-20"
          style={{ left: '50%', transform: 'translateX(-50%)' }}
        >
          <div className="flex rounded-lg bg-gray-100 p-1 w-96">
            <button
              onClick={() => setViewMode('research')}
              className={`py-2 px-4 rounded-md text-sm font-medium transition-colors flex-1 text-center ${
                viewMode === 'research'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Research
            </button>
            <button
              onClick={() => setViewMode('marketmap')}
              className={`py-2 px-4 rounded-md text-sm font-medium transition-colors flex-1 text-center ${
                viewMode === 'marketmap'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Market Map
            </button>
            <button
              onClick={() => setViewMode('savedmaps')}
              className={`py-2 px-4 rounded-md text-sm font-medium transition-colors flex-1 text-center ${
                viewMode === 'savedmaps'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Saved Maps
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

  if (!hasSearched && viewMode !== 'savedmaps') {
    // Initial centered search bar layout (skip if showing saved maps)
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
          <Header />
        </div>
      </div>
    );
  }

  // Show saved maps view
  if (viewMode === 'savedmaps') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <Header />
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
        <Header />
        
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
            onSaveSuccess={() => {
              console.log('Market map saved successfully!');
              // If we're viewing saved maps, we could refresh the list here
              // For now, just show a success message
            }}
          />
        </div>
      </div>
    );
  }

  // Research mode - split view layout
  return (
    <div className="h-screen flex flex-col relative">
      <Header />
      
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
                    className="max-w-[80%] p-4 rounded-lg border border-gray-200 bg-gray-50 text-gray-700"
                  >
                    <div className="text-sm leading-relaxed">
                      {item.message}
                    </div>
                  </div>
                </div>
              ))}
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

        {/* Right Half - Trials List */}
        <div className="w-1/2 bg-gray-50 overflow-hidden">
          <TrialsList trials={trials} loading={loading} query={lastQuery} />
        </div>
      </div>
    </div>
  )
}
