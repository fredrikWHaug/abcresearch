 
import React from 'react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  onSendMessage: (message: string) => void;
  loading: boolean;
  hasSearched: boolean;
}

export const InitialResearchView = React.memo(function InitialResearchView({
  selectedPapers,
  selectedPressReleases,
  showContextPanel,
  onToggleContextPanel,
  onRemovePaper,
  onRemovePressRelease,
  onClearContext,
  onSendMessage,
  loading,
  hasSearched
}: InitialResearchViewProps) {
  const [message, setMessage] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const hasAutoFocusedRef = React.useRef(false)

  // Auto-focus input only once on initial mount
  React.useEffect(() => {
    if (!hasAutoFocusedRef.current && inputRef.current) {
      inputRef.current.focus()
      hasAutoFocusedRef.current = true
    }
  }, [])

  const handleSend = () => {
    if (!message.trim() || loading) return
    onSendMessage(message)
    setMessage('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

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
    onSendMessage(query)
  }

  return (
    <div className="w-full max-w-3xl px-6 animate-fade-in">
      <div className="text-center mb-10 space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-2 bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
          Good afternoon
        </h1>
        <p className="text-lg text-gray-500">What are you researching today?</p>
      </div>

      {(selectedPapers.length > 0 || selectedPressReleases.length > 0) && (
        <div className="mb-6 flex justify-center animate-scale-in">
          {(selectedPapers.length + selectedPressReleases.length) <= 2 ? (
            <div className="flex flex-wrap gap-3 justify-center">
              {selectedPapers.map((paper) => (
                <div
                  key={paper.pmid}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50/50 border border-blue-100/50 rounded-full text-sm shadow-sm backdrop-blur-sm"
                >
                  <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-blue-900 font-medium line-clamp-1 max-w-[200px]" title={paper.title}>
                    {paper.title}
                  </span>
                  <Button
                    variant="ghost"
                    onClick={() => onRemovePaper(paper.pmid)}
                    className="flex-shrink-0 text-blue-400 hover:text-blue-600 h-auto w-auto p-0.5 hover:bg-blue-100 rounded-full"
                    title="Remove from context"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              ))}
              {selectedPressReleases.map((pr) => (
                <div
                  key={pr.id}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50/50 border border-purple-100/50 rounded-full text-sm shadow-sm backdrop-blur-sm"
                >
                  <svg className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  <span className="text-purple-900 font-medium line-clamp-1 max-w-[200px]" title={pr.title}>
                    {pr.title}
                  </span>
                  <Button
                    variant="ghost"
                    onClick={() => onRemovePressRelease(pr.id)}
                    className="flex-shrink-0 text-purple-400 hover:text-purple-600 h-auto w-auto p-0.5 hover:bg-purple-100 rounded-full"
                    title="Remove from context"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative context-panel-container">
              <Button
                variant="outline"
                onClick={onToggleContextPanel}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200/50 rounded-full shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300 h-auto"
              >
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-50">
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {selectedPapers.length + selectedPressReleases.length} items selected
                </span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showContextPanel ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </Button>

              {showContextPanel && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 py-2 w-96 max-h-96 overflow-y-auto z-50 animate-scale-in origin-top">
                  <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Research Context</h3>
                    <Button
                      variant="ghost"
                      onClick={onClearContext}
                      className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 hover:bg-red-50 rounded-md h-auto"
                    >
                      Clear All
                    </Button>
                  </div>
                  {/* ... content list remains similar but cleaner ... */}
                  <div className="py-2">
                    {selectedPapers.map((paper) => (
                      <div
                        key={paper.pmid}
                        className="px-4 py-3 hover:bg-gray-50/50 border-b border-gray-50 last:border-b-0 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                              {paper.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {paper.journal} • {paper.publicationDate}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            onClick={() => onRemovePaper(paper.pmid)}
                            className="flex-shrink-0 text-gray-400 hover:text-red-600 h-auto w-auto p-1 hover:bg-red-50 rounded-full"
                            title="Remove from context"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </Button>
                        </div>
                      </div>
                    ))}
                    {selectedPressReleases.map((pr) => (
                      <div
                        key={pr.id}
                        className="px-4 py-3 hover:bg-purple-50/30 border-b border-gray-50 last:border-b-0 bg-purple-50/10 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                              {pr.title}
                            </p>
                            <p className="text-xs text-purple-600 mt-1 font-medium">
                              Press Release • {pr.releaseDate}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            onClick={() => onRemovePressRelease(pr.id)}
                            className="flex-shrink-0 text-gray-400 hover:text-red-600 h-auto w-auto p-1 hover:bg-red-50 rounded-full"
                            title="Remove from context"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </Button>
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

      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-100 via-purple-100 to-pink-100 rounded-full blur opacity-0 group-hover:opacity-40 transition-opacity duration-500"></div>
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={hasSearched ? "Respond to ABCresearch's agent..." : "How can I help you today?"}
            className="flex h-16 w-full rounded-full border border-gray-200 bg-white pl-6 pr-16 text-lg shadow-sm transition-all duration-300 placeholder:text-gray-400 focus:border-blue-300/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
          />
          <Button
            type="button"
            onClick={handleSend}
            disabled={!message.trim() || loading}
            className="absolute right-2 h-12 w-12 rounded-full bg-gray-900 hover:bg-black disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-300 hover:scale-105 shadow-md text-white p-0"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-white" />
            ) : (
              <ArrowUp className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {!hasSearched && (
        <div className="mt-12 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <p className="text-sm font-medium text-gray-400 mb-4 text-center uppercase tracking-wider text-xs">Suggested Research Paths</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {quickSearches.map(({ id, query }, index) => (
              <Button
                key={id}
                type="button"
                variant="ghost"
                onClick={() => handleQuickSearch(query)}
                disabled={loading}
                className="group relative text-left p-6 rounded-2xl border border-white/40 bg-white/60 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:bg-white transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden backdrop-blur-sm h-auto w-full block whitespace-normal"
                style={{ animationDelay: `${0.1 + index * 0.1}s` }}
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <p className="text-sm text-gray-600 group-hover:text-gray-900 font-medium leading-relaxed">
                  {query}
                </p>
                <div className="mt-4 flex items-center text-xs font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                  Start Research <span className="ml-1">→</span>
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

