import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp, Loader2, Pill } from 'lucide-react';
import { DrugDiscoveryAPI, type Message } from '@/services/drugDiscoveryAPI';
import { EnhancedSearchAPI } from '@/services/enhancedSearchAPI';
import { SearchResultsModal } from '@/components/SearchResultsModal';
import type { ClinicalTrial } from '@/services/clinicalTrialsAPI';

interface ConversationalSearchProps {
  onSearchComplete?: (drugs: string[], trials: ClinicalTrial[]) => void;
}

export const ConversationalSearch: React.FC<ConversationalSearchProps> = ({ 
  onSearchComplete 
}) => {
  const [message, setMessage] = useState('');
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    drugs: string[];
    trials: ClinicalTrial[];
    query: string;
  } | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory]);

  const handleSendMessage = async () => {
    if (!message.trim() || loading) return;

    const userMessage = message.trim();
    setMessage('');

    // Add user message to history
    const updatedHistory: Message[] = [
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];
    setConversationHistory(updatedHistory);

    try {
      setLoading(true);

      // Send to drug discovery API
      const response = await DrugDiscoveryAPI.sendMessage(userMessage, conversationHistory);

      // Add assistant response to history
      setConversationHistory(prev => [
        ...prev,
        { role: 'assistant', content: response.assistantMessage }
      ]);

      // If ready to search, execute the search
      if (response.isReadyToSearch && response.finalDrugs) {
        await executeSearch(response.finalDrugs);
      }
    } catch (error) {
      console.error('Error in conversation:', error);
      setConversationHistory(prev => [
        ...prev,
        { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error. Please try again.' 
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const executeSearch = async (drugs: string[]) => {
    try {
      setSearching(true);

      // Add searching message
      setConversationHistory(prev => [
        ...prev,
        { 
          role: 'assistant', 
          content: `Great! I'm now searching for clinical trials related to: ${drugs.join(', ')}. This may take a moment...` 
        }
      ]);

      // Search for clinical trials using the drugs
      const searchQuery = drugs.join(' OR ');
      const result = await EnhancedSearchAPI.searchWithEnhancement(searchQuery);

      // Store results
      setSearchResults({
        drugs,
        trials: result.trials,
        query: searchQuery
      });

      // Add completion message
      setConversationHistory(prev => [
        ...prev,
        { 
          role: 'assistant', 
          content: `I found ${result.trials.length} clinical trials related to these drugs! Click "View Results" to see them.` 
        }
      ]);

      // Show results modal
      setShowResults(true);

      // Notify parent
      if (onSearchComplete) {
        onSearchComplete(drugs, result.trials);
      }
    } catch (error) {
      console.error('Error executing search:', error);
      setConversationHistory(prev => [
        ...prev,
        { 
          role: 'assistant', 
          content: 'Sorry, there was an error conducting the search. Please try again.' 
        }
      ]);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleViewResults = () => {
    setShowResults(true);
  };

  // Initial empty state
  if (conversationHistory.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="w-full max-w-2xl px-6">
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Pill className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Drug Discovery Search</h1>
            <p className="text-lg text-gray-600">
              Tell me what type of therapeutic you're looking for, and I'll help you find the exact drugs
            </p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Example searches:</h3>
              <div className="space-y-2">
                <div className="text-sm text-gray-600 bg-gray-50 px-4 py-3 rounded-lg">
                  "I'm looking for checkpoint inhibitors for melanoma"
                </div>
                <div className="text-sm text-gray-600 bg-gray-50 px-4 py-3 rounded-lg">
                  "Show me EGFR inhibitors in lung cancer"
                </div>
                <div className="text-sm text-gray-600 bg-gray-50 px-4 py-3 rounded-lg">
                  "What CAR-T therapies are available for hematologic malignancies?"
                </div>
              </div>
            </div>
            
            <div className="relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Describe the type of therapeutic you're searching for..."
                className="flex h-[60px] w-full rounded-xl border-2 border-gray-200 bg-white pl-4 pr-16 py-2 text-lg ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                disabled={loading}
                autoFocus
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim() || loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-lg"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <ArrowUp className="h-5 w-5 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chat interface
  return (
    <>
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Pill className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Drug Discovery Assistant</h2>
                <p className="text-sm text-gray-600">Helping you find the right therapeutics</p>
              </div>
            </div>
            
            {searchResults && (
              <Button onClick={handleViewResults} className="bg-blue-600 hover:bg-blue-700">
                View Results
              </Button>
            )}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
            {conversationHistory.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-6 py-4 shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}
                >
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            
            {(loading || searching) && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-800 border border-gray-200 rounded-2xl px-6 py-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-sm text-gray-600">
                      {searching ? 'Searching clinical trials...' : 'Thinking...'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 px-6 py-4 shadow-lg">
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Continue the conversation..."
                className="flex h-[56px] w-full rounded-xl border-2 border-gray-200 bg-white pl-4 pr-16 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                disabled={loading || searching}
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim() || loading || searching}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                {loading || searching ? (
                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results Modal */}
      {searchResults && (
        <SearchResultsModal
          open={showResults}
          onClose={() => setShowResults(false)}
          drugs={searchResults.drugs}
          trials={searchResults.trials}
          query={searchResults.query}
        />
      )}
    </>
  );
};

