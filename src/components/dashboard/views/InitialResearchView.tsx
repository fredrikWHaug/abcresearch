 
import React from 'react'
import { ArrowUp } from 'lucide-react'
import type { PubMedArticle } from '@/types/papers'
import type { PressRelease } from '@/types/press-releases'

interface InitialResearchViewProps {
  selectedPapers: PubMedArticle[];
  selectedPressReleases: PressRelease[];
  showContextPanel: boolean;
  onToggleContextPanel: () => void;
  onRemovePaper: (pmid: string) => void;
  onRemovePressRelease: (id: string) => void;
  onClearContext: () => void;
  message: string;
  onMessageChange: (value: string) => void;
  onSendMessage: (messageOverride?: string) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  loading: boolean;
  hasSearched: boolean;
}

export function InitialResearchView({
  selectedPapers,
  selectedPressReleases,
  showContextPanel,
  onToggleContextPanel,
  onRemovePaper,
  onRemovePressRelease,
  onClearContext,
  message,
  onMessageChange,
  onSendMessage,
  onKeyPress,
  loading,
  hasSearched
}: InitialResearchViewProps) {
  const quickSearches = [
    {
      id: 'glp1',
      query: 'Find research for GLP-1 drugs in Phase 2 and 3 for the diabetes mellitus indication'
    },
    {
      id: 'crispr',
      query: 'Summarize CRISPR gene therapy trials for sickle cell disease with enrollment over 50 patients'
    },
    {
      id: 'her2',
      query: 'Compare Phase 1 HER2-positive breast cancer assets across top biotech sponsors'
    }
  ]

  const handleQuickSearch = (query: string) => {
    if (loading) return
    onMessageChange(query)
    onSendMessage(query)
  }

  return (
    <div className="w-full max-w-2xl px-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-semibold text-gray-800 mb-2">Welcome back</h1>
      </div>

      {(selectedPapers.length > 0 || selectedPressReleases.length > 0) && (
        <div className="mb-3 flex justify-center">
          {(selectedPapers.length + selectedPressReleases.length) <= 2 ? (
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
                    onClick={() => onRemovePaper(paper.pmid)}
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
                    onClick={() => onRemovePressRelease(pr.id)}
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
            <div className="relative context-panel-container">
              <button
                onClick={onToggleContextPanel}
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

              {showContextPanel && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 w-96 max-h-96 overflow-y-auto z-50">
                  <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">AI Context</h3>
                    <button
                      onClick={onClearContext}
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
                            onClick={() => onRemovePaper(paper.pmid)}
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
                            onClick={() => onRemovePressRelease(pr.id)}
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
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder={hasSearched ? "Respond to ABCresearch's agent..." : "How can I help you today?"}
          className="flex h-[60px] w-full rounded-md border border-gray-300 bg-white pl-4 pr-16 py-2 text-lg ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading}
          autoFocus
        />
        <button
          type="button"
          onClick={() => onSendMessage()}
          disabled={!message.trim() || loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        >
          <ArrowUp className="h-4 w-4 text-white" />
        </button>
      </div>

      {!hasSearched && (
        <div className="mt-6">
          <p className="text-sm text-gray-500 mb-3 text-center">Try one of these quick research prompts</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {quickSearches.map(({ id, query }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleQuickSearch(query)}
                disabled={loading}
                className="text-left p-4 rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 transition-colors text-sm text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

