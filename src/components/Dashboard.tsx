import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { LogOut, Send } from 'lucide-react'
import { MarketMap } from '@/components/MarketMap'
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

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    const userMessage = message.trim();
    setMessage('');
    setLastQuery(userMessage);
    
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

  return (
    <div className="h-screen flex">
      {/* Left Half - Chat Interface */}
      <div className="w-1/2 bg-background flex flex-col h-screen">
        {/* Chat Messages Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-4">
            {chatHistory.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <p className="text-lg font-medium">Welcome to ABCresearch</p>
                <p className="mt-2">Search for clinical trials using natural language</p>
                <p className="text-sm mt-4">Try queries like:</p>
                <ul className="text-sm mt-2 space-y-1">
                  <li>"Phase 2 oncology trials"</li>
                  <li>"Pfizer diabetes studies"</li>
                  <li>"Recruiting trials for Alzheimer's"</li>
                </ul>
              </div>
            ) : (
              chatHistory.map((item, index) => (
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
              ))
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6 border-t">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-end space-x-3">
              <div className="flex-1">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Search clinical trials... (e.g., 'Phase 3 cancer trials by Merck')"
                  className="min-h-[50px] resize-none"
                  disabled={loading}
                />
              </div>
              <Button 
                onClick={handleSendMessage}
                disabled={!message.trim() || loading}
                size="icon"
                className="h-[50px] w-[50px]"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Half - Market Map */}
      <div className="w-1/2 bg-gray-50 h-screen overflow-hidden">
        <MarketMap trials={trials} loading={loading} query={lastQuery} />
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
