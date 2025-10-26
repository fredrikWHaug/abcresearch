import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, Pill, FileText, FlaskConical, Search, X, Target, Loader2 } from 'lucide-react';
import type { DrugGroup } from '@/services/drugGroupingService';
import type { StrategyResult } from '@/services/gatherSearchResults';

interface DrugsListProps {
  drugGroups: DrugGroup[];
  loading: boolean;
  query: string;
  onDrugClick: (drugGroup: DrugGroup) => void;
  onDrugSpecificSearch?: (drugName: string) => Promise<void>;
  initialSearchQueries?: {
    originalQuery: string;
    strategies?: StrategyResult[];
  } | null;
}

export function DrugsList({ drugGroups, loading, query, onDrugClick, onDrugSpecificSearch, initialSearchQueries = null }: DrugsListProps) {
  const [hoveredDrug, setHoveredDrug] = useState<string | null>(null);
  const [showSearchTermsModal, setShowSearchTermsModal] = useState(false);
  const [searchingDrug, setSearchingDrug] = useState<string | null>(null);

  const handleDrugSpecificSearch = async (drugName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!onDrugSpecificSearch) return;
    
    setSearchingDrug(drugName);
    try {
      await onDrugSpecificSearch(drugName);
    } finally {
      setSearchingDrug(null);
    }
  };

  if (drugGroups.length === 0 && (loading || !query)) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Analyzing search results...</p>
          <p className="mt-2 text-sm text-gray-500">Drug results will appear here shortly</p>
        </div>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <Pill className="h-12 w-12 mx-auto mb-3 text-gray-400" />
          <p>Enter a search query to explore drugs</p>
          <p className="text-sm mt-2">Try: "GLP-1 agonists for diabetes"</p>
        </div>
      </div>
    );
  }

  if (drugGroups.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No drugs found for: "{query}"</p>
          <p className="text-sm text-gray-500 mt-2">Try adjusting your search terms</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col relative">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">
                  Drugs Found ({drugGroups.length})
                </h2>
                <p className="text-gray-600 mt-1">
                  Click on a drug to view related papers and clinical trials
                </p>
                
                {/* Loading indicator when more results are coming */}
                {loading && drugGroups.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>Finding more drugs...</span>
                  </div>
                )}
              </div>
              
              {/* View Search Terms Button */}
              {initialSearchQueries && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSearchTermsModal(true)}
                  className="flex items-center gap-2"
                >
                  <Search className="h-4 w-4" />
                  View Search Terms
                </Button>
              )}
            </div>
          </div>

          {/* Drug Cards */}
          <div className="space-y-3">
            {drugGroups.map((drugGroup) => (
              <Card
                key={drugGroup.normalizedName}
                className={`hover:shadow-lg transition-all cursor-pointer border-2 ${
                  hoveredDrug === drugGroup.normalizedName
                    ? 'border-blue-500 shadow-md'
                    : 'border-transparent'
                }`}
                onClick={() => onDrugClick(drugGroup)}
                onMouseEnter={() => setHoveredDrug(drugGroup.normalizedName)}
                onMouseLeave={() => setHoveredDrug(null)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    {/* Left: Drug Info */}
                    <div className="flex items-center gap-4 flex-1">
                      {/* Icon */}
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Pill className="h-6 w-6 text-blue-600" />
                      </div>

                      {/* Drug Name and Stats */}
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {drugGroup.drugName}
                        </h3>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                              <span className="font-semibold text-gray-900">
                                {drugGroup.papers.length}
                              </span>{' '}
                              paper{drugGroup.papers.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <FlaskConical className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                              <span className="font-semibold text-gray-900">
                                {drugGroup.trials.length}
                              </span>{' '}
                              trial{drugGroup.trials.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* Deep Dive Search Button */}
                      {onDrugSpecificSearch && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleDrugSpecificSearch(drugGroup.drugName, e)}
                          disabled={searchingDrug === drugGroup.drugName}
                          className="flex items-center gap-2 text-xs"
                          title="Run targeted search for this specific drug"
                        >
                          {searchingDrug === drugGroup.drugName ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Searching...
                            </>
                          ) : (
                            <>
                              <Target className="h-3 w-3" />
                              Deep Dive
                            </>
                          )}
                        </Button>
                      )}
                      
                      <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">
                        {drugGroup.totalResults} total
                      </Badge>
                      <ChevronRight
                        className={`h-5 w-5 text-gray-400 transition-transform ${
                          hoveredDrug === drugGroup.normalizedName
                            ? 'translate-x-1 text-blue-600'
                            : ''
                        }`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Search Terms Modal */}
      {showSearchTermsModal && initialSearchQueries && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowSearchTermsModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Initial Landscaping Search Queries</h2>
                <p className="text-sm text-gray-600 mt-1">Broad search queries used in Stage 1 to discover all relevant drugs</p>
              </div>
              <button
                onClick={() => setShowSearchTermsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="space-y-6">
                {/* Original Query */}
                <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Search className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Original User Query</h3>
                  </div>
                  <div className="bg-white border border-blue-200 rounded-md p-3">
                    <code className="text-sm text-gray-800 break-all">{initialSearchQueries.originalQuery}</code>
                  </div>
                </div>

                {/* LLM-Generated Discovery Strategies */}
                {initialSearchQueries.strategies && initialSearchQueries.strategies.length > 0 ? (
                  <div className="space-y-4">
                    <div className="border-b pb-2">
                      <h3 className="text-lg font-bold text-gray-900">
                        🤖 AI-Generated Discovery Strategies ({initialSearchQueries.strategies.length})
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Phrase-based queries to discover drugs across all development stages
                      </p>
                    </div>
                    
                    {initialSearchQueries.strategies.map((strategyResult, index) => {
                      const { strategy, count } = strategyResult;
                      const priorityColors = {
                        high: 'bg-red-50 border-red-200',
                        medium: 'bg-yellow-50 border-yellow-200',
                        low: 'bg-blue-50 border-blue-200'
                      };
                      const priorityBadgeColors = {
                        high: 'bg-red-100 text-red-800',
                        medium: 'bg-yellow-100 text-yellow-800',
                        low: 'bg-blue-100 text-blue-800'
                      };
                      
                      return (
                        <div 
                          key={index} 
                          className={`border rounded-lg p-4 ${priorityColors[strategy.priority]}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-gray-700">#{index + 1}</span>
                              <Badge className={`text-xs ${priorityBadgeColors[strategy.priority]}`}>
                                {strategy.priority}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {strategy.searchType}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <FlaskConical className="h-4 w-4" />
                              <span className="font-semibold">{count} trials</span>
                            </div>
                          </div>
                          
                          <div className="bg-white border border-gray-300 rounded-md p-3 mb-2">
                            <code className="text-sm text-gray-800 font-mono break-all">
                              {strategy.query}
                            </code>
                          </div>
                          
                          <p className="text-sm text-gray-700 italic">
                            💡 {strategy.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Fallback to old format if no strategies */
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center gap-2 mb-3">
                        <FlaskConical className="h-5 w-5 text-purple-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Basic Search Strategy</h3>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-md p-3">
                        <code className="text-sm text-gray-800 break-all">{initialSearchQueries.originalQuery}</code>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info Box */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-sm text-green-800">
                      <p className="font-medium">Discovery-Focused Approach</p>
                      <p className="mt-1">These phrase-based queries cast a wide net to DISCOVER drugs across all stages (preclinical → approved), not just search for known drugs. Drug names are then extracted from all results.</p>
                      {initialSearchQueries.strategies && (
                        <p className="mt-2">
                          <strong>Results:</strong> Found {new Set(initialSearchQueries.strategies.flatMap(s => s.trials.map(t => t.nctId))).size} unique trials across {initialSearchQueries.strategies.length} strategies.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end p-6 border-t bg-gray-50">
              <Button onClick={() => setShowSearchTermsModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

