 
import React from 'react'
import { ArrowUp } from 'lucide-react'
import type { ChatMessage } from '@/types/chat'
import type { PubMedArticle } from '@/types/papers'
import type { PressRelease } from '@/types/press-releases'
import type { SearchSuggestion } from './types'

interface ContextSummaryProps {
  selectedPapers: PubMedArticle[]
  selectedPressReleases: PressRelease[]
  showContextPanel: boolean
  onToggleContextPanel: () => void
  onRemovePaper: (pmid: string) => void
  onRemovePressRelease: (id: string) => void
  onClearContext: () => void
}

const ContextSummary = ({
  selectedPapers,
  selectedPressReleases,
  showContextPanel,
  onToggleContextPanel,
  onRemovePaper,
  onRemovePressRelease,
  onClearContext
}: ContextSummaryProps) => {
  const total = selectedPapers.length + selectedPressReleases.length
  if (total === 0) return null

  if (total <= 2) {
    return (
      <div className="flex flex-wrap gap-2 mb-3">
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
    )
  }

  return (
    <div className="relative context-panel-container mb-3">
      <button
        onClick={onToggleContextPanel}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
      >
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-sm font-medium text-blue-900">
          Context ({total})
        </span>
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {showContextPanel && (
        <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 w-96 max-h-96 overflow-y-auto z-50">
          <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">AI Context</h3>
            <button onClick={onClearContext} className="text-xs text-red-600 hover:text-red-700 font-medium">
              Clear All
            </button>
          </div>
          <div className="py-2">
            {selectedPapers.map((paper) => (
              <div key={paper.pmid} className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{paper.title}</p>
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
              <div key={pr.id} className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 bg-purple-50/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{pr.title}</p>
                    <p className="text-xs text-purple-600 mt-1">Press Release • {pr.releaseDate}</p>
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
  )
}

interface ResearchChatViewProps {
  chatHistory: ChatMessage[]
  selectedPapers: PubMedArticle[]
  selectedPressReleases: PressRelease[]
  showContextPanel: boolean
  onToggleContextPanel: () => void
  onRemovePaper: (pmid: string) => void
  onRemovePressRelease: (id: string) => void
  onClearContext: () => void
  handleSearchSuggestion: (suggestion: SearchSuggestion) => Promise<void>
  message: string
  onMessageChange: (value: string) => void
  onSendMessage: () => void
  onKeyPress: (e: React.KeyboardEvent) => void
  loading: boolean
}

export function ResearchChatView({
  chatHistory,
  selectedPapers,
  selectedPressReleases,
  showContextPanel,
  onToggleContextPanel,
  onRemovePaper,
  onRemovePressRelease,
  onClearContext,
  handleSearchSuggestion,
  message,
  onMessageChange,
  onSendMessage,
  onKeyPress,
  loading
}: ResearchChatViewProps) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const prevChatLengthRef = React.useRef(0)

  // Auto-scroll ONLY when new messages are added (not on content updates)
  React.useEffect(() => {
    // Only scroll if a NEW message was added, not if existing messages were updated
    if (chatHistory.length > prevChatLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
      prevChatLengthRef.current = chatHistory.length
    }
  }, [chatHistory])

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      {/* Scrollable messages area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full px-6 py-8">
          <div className="space-y-4">
            {chatHistory.map((item, index) => (
              <div
                key={`${item.type}-${index}-${item.message}`}
                className={`p-4 rounded-lg border ${
                  item.type === 'user'
                    ? 'bg-gray-800 text-white border-gray-700'
                    : 'bg-gray-50 text-gray-700 border-gray-200'
                }`}
              >
                {item.message.startsWith('progress:') ? (
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <div className="text-sm font-medium text-gray-900">
                      {item.message.replace('progress:', '')}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm leading-relaxed">{item.message}</div>

                    {((item.contextPapers && item.contextPapers.length > 0) || (item.contextPressReleases && item.contextPressReleases.length > 0)) && (
                      <div className="mt-2 space-y-2">
                        {item.contextPapers && item.contextPapers.length > 0 && (
                          <details className="cursor-pointer">
                            <summary
                              className={`text-xs font-medium inline-flex items-center gap-1 px-2 py-1 rounded ${
                                item.type === 'user'
                                  ? 'bg-blue-700 text-blue-100 hover:bg-blue-600'
                                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              }`}
                            >
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

                        {item.contextPressReleases && item.contextPressReleases.length > 0 && (
                          <details className="cursor-pointer">
                            <summary
                              className={`text-xs font-medium inline-flex items-center gap-1 px-2 py-1 rounded ${
                                item.type === 'user'
                                  ? 'bg-purple-700 text-purple-100 hover:bg-purple-600'
                                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                              }`}
                            >
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

                {item.searchSuggestions && item.searchSuggestions.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>Recommended Search:</span>
                    </div>
                    {item.searchSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        onClick={() => handleSearchSuggestion(suggestion)}
                        className="group w-full text-left p-5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 border-2 border-blue-800 rounded-xl transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-[1.03] cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1">
                            <svg className="w-6 h-6 text-white flex-shrink-0 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <span className="font-bold text-white text-lg">{suggestion.label}</span>
                          </div>
                          <span className="text-sm font-medium text-blue-100 bg-blue-700/50 px-3 py-1 rounded-full whitespace-nowrap">
                            Click to Search →
                          </span>
                        </div>
                        {suggestion.description && (
                          <p className="text-sm text-blue-100 mt-3 ml-9">{suggestion.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {/* Invisible element for auto-scroll */}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Fixed input area at bottom */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white shadow-lg">
        <div className="max-w-4xl mx-auto w-full px-6 py-4">
          <ContextSummary
            selectedPapers={selectedPapers}
            selectedPressReleases={selectedPressReleases}
            showContextPanel={showContextPanel}
            onToggleContextPanel={onToggleContextPanel}
            onRemovePaper={onRemovePaper}
            onRemovePressRelease={onRemovePressRelease}
            onClearContext={onClearContext}
          />

          <div className="relative">
            <input
              type="text"
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              onKeyPress={onKeyPress}
              placeholder="Respond to ABCresearch's agent..."
              className="flex h-[60px] w-full rounded-md border border-gray-300 bg-white pl-4 pr-16 py-2 text-lg ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
              autoFocus
            />
            <button
              onClick={onSendMessage}
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
