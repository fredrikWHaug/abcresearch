import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { LogOut, Send } from 'lucide-react'
import { MarketMap } from '@/components/MarketMap'
import { TrialsList } from '@/components/TrialsList'
import { ClinicalTrialsAPI } from '@/services/clinicalTrialsAPI'
import type { ClinicalTrial } from '@/services/clinicalTrialsAPI'

export function Dashboard() {
  const { signOut } = useAuth()
  
  const handleSignOut = async () => {
    console.log('Logout button clicked!');
    try {
      await signOut();
      console.log('Sign out successful');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }
  const [message, setMessage] = useState('')
  const [trials, setTrials] = useState<ClinicalTrial[]>([])
  const [loading, setLoading] = useState(false)
  const [lastQuery, setLastQuery] = useState('')
  const [chatHistory, setChatHistory] = useState<Array<{type: 'user' | 'system', message: string}>>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [viewMode, setViewMode] = useState<'research' | 'marketmap'>('research')

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
      
      // Parse the natural language query
      const searchParams = ClinicalTrialsAPI.parseQuery(userMessage);
      
      // Fetch trials from the API
      const result = await ClinicalTrialsAPI.searchTrials(searchParams);
      
      setTrials(result.trials);
      
      // Add system response to chat history
      setChatHistory(prev => [...prev, { 
        type: 'system', 
        message: `Found ${result.trials.length} clinical trials matching your query. Results are displayed in the Market Map.` 
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

  if (!hasSearched) {
    // Initial centered search bar layout
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
              placeholder="Search clinical trials... (e.g., 'Phase 3 cancer trials by Merck')"
              className="flex h-[60px] w-full rounded-md border border-gray-300 bg-white pl-4 pr-16 py-2 text-lg ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
              autoFocus
            />
            <button
              onClick={handleSendMessage}
              disabled={!message.trim() || loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <Send className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {/* Logout Icon - Top Left */}
        <button
          onClick={handleSignOut}
          className="fixed top-6 left-6 p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow border border-gray-200 hover:bg-gray-50 z-50"
          title="Sign Out"
        >
          <LogOut className="h-5 w-5 text-gray-600 hover:text-red-600" />
        </button>
      </div>
    );
  }

  // Shared toggle component
  const ToggleButtons = () => (
    <div className="p-4 border-b bg-white relative z-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setViewMode('research')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'research'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Research
          </button>
          <button
            onClick={() => setViewMode('marketmap')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'marketmap'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Market Map
          </button>
        </div>
      </div>
    </div>
  );

  // After search - conditional layout based on view mode
  if (viewMode === 'marketmap') {
    // Full screen market map view
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <ToggleButtons />
        {/* Full Screen Market Map */}
        <div className="flex-1 overflow-hidden bg-gray-50">
          <MarketMap trials={trials} loading={loading} query={lastQuery} isFullScreen={true} />
        </div>
        {/* Logout Icon - Top Left */}
        <button
          onClick={handleSignOut}
          className="fixed top-6 left-6 p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow border border-gray-200 hover:bg-gray-50 z-50"
          title="Sign Out"
        >
          <LogOut className="h-5 w-5 text-gray-600 hover:text-red-600" />
        </button>
      </div>
    );
  }

  // Research mode - split view layout
  return (
    <div className="h-screen flex flex-col">
      <ToggleButtons />

      {/* Split View Content */}
      <div className="flex-1 flex">
        {/* Left Half - Chat Interface */}
        <div className="w-1/2 bg-background flex flex-col min-h-0">
          {/* Chat Messages Area */}
          <div className="flex-1 p-6 overflow-y-auto min-h-0">
            <div className="max-w-2xl mx-auto space-y-4">
              {chatHistory.map((item, index) => (
                <div
                  key={index}
                  className={`flex ${item.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      item.type === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {item.message}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="p-6 border-t">
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Search clinical trials... (e.g., 'Phase 3 cancer trials by Merck')"
                  className="flex h-[50px] w-full rounded-md border border-gray-300 bg-white pl-4 pr-12 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  <Send className="h-3 w-3 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Half - Trials List or Market Map */}
        <div className="w-1/2 bg-gray-50 overflow-hidden flex flex-col">
          <TrialsList trials={trials} loading={loading} query={lastQuery} />
        </div>
      </div>

      {/* Logout Icon - Top Left */}
      <button
        onClick={handleSignOut}
        className="fixed top-6 left-6 p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow border border-gray-200 hover:bg-gray-50 z-50"
        title="Sign Out"
      >
        <LogOut className="h-5 w-5 text-gray-600 hover:text-red-600" />
      </button>
    </div>
  )
}
