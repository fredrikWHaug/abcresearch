 
import React from 'react'
import { ArrowUp } from 'lucide-react'
import type { ChatMessage } from '@/types/chat'
import type { PubMedArticle } from '@/types/papers'
import type { PressRelease } from '@/types/press-releases'
import type { SearchSuggestion } from './types'
import { GraphCodeExecutor } from '@/components/GraphCodeExecutor'

interface ContextSummaryProps {
  selectedPapers: PubMedArticle[]
  selectedPressReleases: PressRelease[]
  selectedExtractions?: Array<{
    jobId: string
    fileName: string
    markdownContent: string
    hasTables: boolean
  }>
  showContextPanel: boolean
  onToggleContextPanel: () => void
  onRemovePaper: (pmid: string) => void
  onRemovePressRelease: (id: string) => void
  onRemoveExtraction?: (jobId: string) => void
  onClearContext: () => void
}

const ContextSummary = ({
  selectedPapers,
  selectedPressReleases,
  selectedExtractions = [],
  showContextPanel,
  onToggleContextPanel,
  onRemovePaper,
  onRemovePressRelease,
  onRemoveExtraction,
  onClearContext
}: ContextSummaryProps) => {
  const total = selectedPapers.length + selectedPressReleases.length + selectedExtractions.length
  if (total === 0) return null

  if (total <= 2) {
    return (
      <div className="flex flex-wrap gap-3 mb-4">
        {selectedPapers.map((paper) => (
          <div
            key={paper.pmid}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50/50 border border-blue-100 rounded-full text-xs font-medium text-blue-900 shadow-sm backdrop-blur-sm"
          >
            <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="line-clamp-1 max-w-[200px]" title={paper.title}>
              {paper.title}
            </span>
            <button
              onClick={() => onRemovePaper(paper.pmid)}
              className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors p-0.5 hover:bg-blue-100 rounded-full"
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50/50 border border-purple-100 rounded-full text-xs font-medium text-purple-900 shadow-sm backdrop-blur-sm"
          >
            <svg className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            <span className="line-clamp-1 max-w-[200px]" title={pr.title}>
              {pr.title}
            </span>
            <button
              onClick={() => onRemovePressRelease(pr.id)}
              className="flex-shrink-0 text-purple-400 hover:text-purple-600 transition-colors p-0.5 hover:bg-purple-100 rounded-full"
              title="Remove from context"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        {selectedExtractions.map((extraction) => (
          <div
            key={extraction.jobId}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-md text-sm"
          >
            <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className="text-green-900 font-medium line-clamp-1 max-w-[200px]" title={extraction.fileName}>
              {extraction.fileName}
            </span>
            {onRemoveExtraction && (
              <button
                onClick={() => onRemoveExtraction(extraction.jobId)}
                className="flex-shrink-0 text-green-400 hover:text-green-600 transition-colors"
                title="Remove from context"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="relative context-panel-container mb-4">
      <button
        onClick={onToggleContextPanel}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300"
      >
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-50">
          <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <span className="text-xs font-medium text-gray-700">
          Context ({total})
        </span>
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {showContextPanel && (
        <div className="absolute bottom-full left-0 mb-2 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 py-2 w-96 max-h-96 overflow-y-auto z-50 animate-scale-in origin-bottom-left">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">AI Context</h3>
            <button onClick={onClearContext} className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 hover:bg-red-50 rounded-md transition-colors">
              Clear All
            </button>
          </div>
          <div className="py-2">
            {selectedPapers.map((paper) => (
              <div key={paper.pmid} className="px-4 py-3 hover:bg-gray-50/50 border-b border-gray-50 last:border-b-0 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">{paper.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {paper.journal} • {paper.publicationDate}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemovePaper(paper.pmid)}
                    className="flex-shrink-0 text-gray-400 hover:text-red-600 transition-colors p-1 hover:bg-red-50 rounded-full"
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
              <div key={pr.id} className="px-4 py-3 hover:bg-purple-50/30 border-b border-gray-50 last:border-b-0 bg-purple-50/10 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">{pr.title}</p>
                    <p className="text-xs text-purple-600 mt-1 font-medium">Press Release • {pr.releaseDate}</p>
                  </div>
                  <button
                    onClick={() => onRemovePressRelease(pr.id)}
                    className="flex-shrink-0 text-gray-400 hover:text-red-600 transition-colors p-1 hover:bg-red-50 rounded-full"
                    title="Remove from context"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            {selectedExtractions.map((extraction) => (
              <div key={extraction.jobId} className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 bg-green-50/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{extraction.fileName}</p>
                    <p className="text-xs text-green-600 mt-1">PDF Extraction {extraction.hasTables ? '• Contains Tables' : ''}</p>
                  </div>
                  {onRemoveExtraction && (
                    <button
                      onClick={() => onRemoveExtraction(extraction.jobId)}
                      className="flex-shrink-0 text-gray-400 hover:text-red-600 transition-colors"
                      title="Remove from context"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
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
  selectedExtractions?: Array<{
    jobId: string
    fileName: string
    markdownContent: string
    hasTables: boolean
  }>
  showContextPanel: boolean
  onToggleContextPanel: () => void
  onRemovePaper: (pmid: string) => void
  onRemovePressRelease: (id: string) => void
  onRemoveExtraction?: (jobId: string) => void
  onClearContext: () => void
  handleSearchSuggestion: (suggestion: SearchSuggestion) => Promise<void>
  onSendMessage: (message: string) => void
  loading: boolean
}

export const ResearchChatView = React.memo(function ResearchChatView({
  chatHistory,
  selectedPapers,
  selectedPressReleases,
  selectedExtractions = [],
  showContextPanel,
  onToggleContextPanel,
  onRemovePaper,
  onRemovePressRelease,
  onRemoveExtraction,
  onClearContext,
  handleSearchSuggestion,
  onSendMessage,
  loading
}: ResearchChatViewProps) {
  const [message, setMessage] = React.useState('')
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const prevChatLengthRef = React.useRef(0)
  const hasAutoFocusedRef = React.useRef(false)

  // Auto-focus input only once on initial mount
  React.useEffect(() => {
    if (!hasAutoFocusedRef.current && inputRef.current) {
      inputRef.current.focus()
      hasAutoFocusedRef.current = true
    }
  }, [])

  // Auto-scroll ONLY when new messages are added (not on content updates)
  React.useEffect(() => {
    // Only scroll if a NEW message was added, not if existing messages were updated
    if (chatHistory.length > prevChatLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
      prevChatLengthRef.current = chatHistory.length
    }
  }, [chatHistory])

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

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      {/* Scrollable messages area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full px-6 py-8">
          <div className="space-y-4">
            {chatHistory.map((item, index) => (
              <div
                key={`${item.type}-${index}-${item.message}`}
                className={`flex ${item.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div
                  className={`max-w-[85%] p-5 rounded-2xl shadow-sm transition-all duration-300 ${
                    item.type === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm shadow-md'
                      : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
                  }`}
                >
                  {item.message.startsWith('progress:') ? (
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent opacity-70"></div>
                      <div className="text-sm font-medium opacity-90">
                        {item.message.replace('progress:', '')}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Remove Python code block from message if graphCode is present */}
                      {item.graphCode ? (
                        <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium tracking-wide opacity-95">
                          {item.message.replace(/```[Pp]ython\s*\n[\s\S]*?```/g, '').trim() || 'Generated graph code:'}
                        </div>
                      ) : (
                        <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium tracking-wide opacity-95">{item.message}</div>
                      )}

                      {/* Show GraphCodeExecutor if graphCode is present */}
                      {item.graphCode && (
                        <div className="mt-4">
                          <GraphCodeExecutor 
                            code={item.graphCode} 
                            title="Generated Graph"
                          />
                        </div>
                      )}

                      {((item.contextPapers && item.contextPapers.length > 0) || (item.contextPressReleases && item.contextPressReleases.length > 0) || (item.contextExtractions && item.contextExtractions.length > 0)) && (
                        <div className="mt-3 space-y-2">
                          {item.contextPapers && item.contextPapers.length > 0 && (
                            <details className="cursor-pointer group">
                              <summary
                                className={`text-xs font-medium inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                                  item.type === 'user'
                                    ? 'bg-white/20 text-white hover:bg-white/30'
                                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                }`}
                              >
                                <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                Papers ({item.contextPapers.length})
                              </summary>
                              <div className="mt-2 space-y-2 ml-2 pl-2 border-l-2 border-white/20">
                                {item.contextPapers.map((paper) => (
                                  <div
                                    key={paper.pmid}
                                    className={`text-xs p-3 rounded-xl backdrop-blur-sm ${
                                      item.type === 'user'
                                        ? 'bg-black/20 text-white/90'
                                        : 'bg-gray-50 text-gray-600 border border-gray-100'
                                    }`}
                                  >
                                    <div className="font-semibold line-clamp-2 leading-snug">{paper.title}</div>
                                    <div className={`text-[10px] uppercase tracking-wider mt-1.5 font-medium ${
                                      item.type === 'user' ? 'text-white/70' : 'text-gray-400'
                                    }`}>
                                      {paper.journal} • {paper.publicationDate}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}

                          {item.contextPressReleases && item.contextPressReleases.length > 0 && (
                            <details className="cursor-pointer group">
                              <summary
                                className={`text-xs font-medium inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                                  item.type === 'user'
                                    ? 'bg-white/20 text-white hover:bg-white/30'
                                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                                }`}
                              >
                                <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                Press Releases ({item.contextPressReleases.length})
                              </summary>
                              <div className="mt-2 space-y-2 ml-2 pl-2 border-l-2 border-white/20">
                                {item.contextPressReleases.map((pr) => (
                                  <div
                                    key={pr.id}
                                    className={`text-xs p-3 rounded-xl backdrop-blur-sm ${
                                      item.type === 'user'
                                        ? 'bg-black/20 text-white/90'
                                        : 'bg-purple-50/50 text-purple-900 border border-purple-100'
                                    }`}
                                  >
                                    <div className="font-semibold line-clamp-2 leading-snug">{pr.title}</div>
                                    <div className={`text-[10px] uppercase tracking-wider mt-1.5 font-medium ${
                                      item.type === 'user' ? 'text-white/70' : 'text-purple-600/70'
                                    }`}>
                                      {pr.company} • {pr.releaseDate}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}

                          {item.contextExtractions && item.contextExtractions.length > 0 && (
                            <details className="cursor-pointer group">
                              <summary
                                className={`text-xs font-medium inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                                  item.type === 'user'
                                    ? 'bg-white/20 text-white hover:bg-white/30'
                                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                                }`}
                              >
                                <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                Extracted Papers ({item.contextExtractions.length})
                              </summary>
                              <div className="mt-2 space-y-2 ml-2 pl-2 border-l-2 border-white/20">
                                {item.contextExtractions.map((extraction, extractionIndex) => (
                                  <div
                                    key={`${index}-extraction-${extraction.jobId}-${extractionIndex}`}
                                    className={`text-xs p-3 rounded-xl backdrop-blur-sm ${
                                      item.type === 'user'
                                        ? 'bg-black/20 text-white/90'
                                        : 'bg-green-50/50 text-green-900 border border-green-100'
                                    }`}
                                  >
                                    <div className="font-semibold line-clamp-2 leading-snug">{extraction.fileName}</div>
                                    <div className={`text-[10px] uppercase tracking-wider mt-1.5 font-medium ${
                                      item.type === 'user' ? 'text-white/70' : 'text-green-600/70'
                                    }`}>
                                      PDF Extraction {extraction.hasTables ? '• Contains Tables' : ''}
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
                    <div className="mt-4 space-y-2">
                      {item.searchSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          onClick={() => handleSearchSuggestion(suggestion)}
                          className="w-full text-left p-3.5 bg-blue-50/50 hover:bg-blue-100/50 border border-blue-100 rounded-xl transition-all duration-200 hover:shadow-sm group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full ring-4 ring-blue-100 group-hover:ring-blue-200 transition-all"></div>
                            <span className="font-semibold text-blue-900">{suggestion.label}</span>
                          </div>
                          {suggestion.description && (
                            <p className="text-xs text-blue-700/80 mt-1 ml-5 font-medium">{suggestion.description}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {/* Invisible element for auto-scroll */}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Fixed input area at bottom */}
      <div className="flex-shrink-0 border-t border-white/20 bg-white/80 backdrop-blur-xl shadow-[0_-4px_30px_rgba(0,0,0,0.03)] z-20">
        <div className="max-w-4xl mx-auto w-full px-6 py-6">
          <ContextSummary
            selectedPapers={selectedPapers}
            selectedPressReleases={selectedPressReleases}
            selectedExtractions={selectedExtractions}
            showContextPanel={showContextPanel}
            onToggleContextPanel={onToggleContextPanel}
            onRemovePaper={onRemovePaper}
            onRemovePressRelease={onRemovePressRelease}
            onRemoveExtraction={onRemoveExtraction}
            onClearContext={onClearContext}
          />

          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-100 via-purple-100 to-pink-100 rounded-full blur opacity-0 group-hover:opacity-40 transition-opacity duration-500"></div>
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Respond to ABCresearch's agent..."
                className="flex h-16 w-full rounded-full border border-gray-200 bg-white pl-6 pr-16 text-lg shadow-sm transition-all duration-300 placeholder:text-gray-400 focus:border-blue-300/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={!message.trim() || loading}
                className="absolute right-2 h-12 w-12 rounded-full bg-gray-900 hover:bg-black disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-300 hover:scale-105 shadow-md text-white"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-white" />
                ) : (
                  <ArrowUp className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
