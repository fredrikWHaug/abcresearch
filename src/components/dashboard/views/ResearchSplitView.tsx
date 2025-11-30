 
import React from 'react'
import { ArrowUp } from 'lucide-react'
import { DrugsList } from '@/components/DrugsList'
import { DrugDetail } from '@/components/DrugDetail'
import { DrugDetailModal } from '@/components/DrugDetailModal'
import type { DrugGroup } from '@/services/drugGroupingService'
import type { PubMedArticle } from '@/types/papers'
import type { PressRelease } from '@/types/press-releases'
import type { ChatMessage } from '@/types/chat'
import type { StrategyResult } from '@/services/gatherSearchResults'
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
      <div className="flex flex-wrap gap-3">
        {selectedPapers.map((paper) => (
          <div key={paper.pmid} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50/50 border border-blue-100 rounded-full text-xs font-medium text-blue-900 shadow-sm backdrop-blur-sm">
            <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="line-clamp-1 max-w-[200px]" title={paper.title}>
              {paper.title}
            </span>
            <button
              onClick={() => onRemovePaper(paper.pmid)}
              className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors p-0.5 hover:bg-blue-100 rounded-full cursor-pointer"
              title="Remove from context"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        {selectedPressReleases.map((pr) => (
          <div key={pr.id} className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50/50 border border-purple-100 rounded-full text-xs font-medium text-purple-900 shadow-sm backdrop-blur-sm">
            <svg className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            <span className="line-clamp-1 max-w-[200px]" title={pr.title}>
              {pr.title}
            </span>
            <button
              onClick={() => onRemovePressRelease(pr.id)}
              className="flex-shrink-0 text-purple-400 hover:text-purple-600 transition-colors p-0.5 hover:bg-purple-100 rounded-full cursor-pointer"
              title="Remove from context"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        {selectedExtractions.map((extraction) => (
          <div key={extraction.jobId} className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-md text-sm">
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
    <div className="relative context-panel-container">
      <button
        onClick={onToggleContextPanel}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300 cursor-pointer"
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
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 py-2 w-96 max-h-96 overflow-y-auto z-50 animate-scale-in origin-bottom">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">AI Context</h3>
            <button
              onClick={onClearContext}
              className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
            >
              Clear All
            </button>
          </div>
          <div className="py-2">
            {selectedPapers.map((paper) => (
              <div key={paper.pmid} className="px-4 py-3 hover:bg-gray-50/50 border-b border-gray-50 last:border-b-0 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                      {paper.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {paper.journal} • {paper.publicationDate}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemovePaper(paper.pmid)}
                    className="flex-shrink-0 text-gray-400 hover:text-red-600 transition-colors p-1 hover:bg-red-50 rounded-full cursor-pointer"
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
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                      {pr.title}
                    </p>
                    <p className="text-xs text-purple-600 mt-1 font-medium">
                      Press Release • {pr.releaseDate}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemovePressRelease(pr.id)}
                    className="flex-shrink-0 text-gray-400 hover:text-red-600 transition-colors p-1 hover:bg-red-50 rounded-full cursor-pointer"
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
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">
                      {extraction.fileName}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      PDF Extraction {extraction.hasTables ? '• Contains Tables' : ''}
                    </p>
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

interface ResearchSplitViewProps {
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
  onSendMessage: (message: string) => void
  handleSearchSuggestion: (suggestion: SearchSuggestion) => Promise<void>
  loading: boolean
  selectedDrug: DrugGroup | null
  setSelectedDrug: React.Dispatch<React.SetStateAction<DrugGroup | null>>
  drugGroups: DrugGroup[]
  searchProgress: { current: number; total: number }
  handleDrugSpecificSearch: (drugName: string) => Promise<void>
  initialSearchQueries: {
    originalQuery: string
    strategies?: StrategyResult[]
  } | null
  showDrugModal: boolean
  setShowDrugModal: React.Dispatch<React.SetStateAction<boolean>>
  handleAddPaperToContext: (paper: PubMedArticle) => void
  isPaperInContext: (pmid: string) => boolean
  handleAddPressReleaseToContext: (pressRelease: PressRelease) => void
  isPressReleaseInContext: (id: string) => boolean
}

export const ResearchSplitView = React.memo(function ResearchSplitView({
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
  onSendMessage,
  handleSearchSuggestion,
  loading,
  selectedDrug,
  setSelectedDrug,
  drugGroups,
  searchProgress,
  handleDrugSpecificSearch,
  initialSearchQueries,
  showDrugModal,
  setShowDrugModal,
  handleAddPaperToContext,
  isPaperInContext,
  handleAddPressReleaseToContext,
  isPressReleaseInContext
}: ResearchSplitViewProps) {
  const [message, setMessage] = React.useState('')
  const isStageTwoInProgress = searchProgress.total > 0 && searchProgress.current < searchProgress.total
  const currentQuery = initialSearchQueries?.originalQuery || ''
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
    <div className="h-full flex flex-col relative overflow-hidden">
      <div className="absolute w-px h-full bg-border/40 backdrop-blur-sm z-10 top-0 pointer-events-none" style={{ left: '50%', transform: 'translateX(-0.5px)' }}></div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="w-1/2 bg-background flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-4">
              {chatHistory.map((item, index) => (
                <div
                  key={`${item.type}-${index}`}
                  className={`flex ${item.type === 'user' ? 'justify-end' : 'justify-start'}`}
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
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{item.message.replace('progress:', '')}</div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Remove Python code block from message if graphCode is present */}
                        {item.graphCode ? (
                          <div className="text-sm leading-relaxed">
                            {item.message.replace(/```[Pp]ython\s*\n[\s\S]*?```/g, '').trim() || 'Generated graph code:'}
                          </div>
                        ) : (
                          <div className="text-sm leading-relaxed">{item.message}</div>
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
                          <div className="mt-2 space-y-2">
                            {item.contextPapers && item.contextPapers.length > 0 && (
                              <details className="cursor-pointer">
                                <summary className={`text-xs font-medium inline-flex items-center gap-1 px-2 py-1 rounded ${
                                  item.type === 'user'
                                    ? 'bg-blue-700 text-blue-100 hover:bg-blue-600'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }`}>
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
                                <summary className={`text-xs font-medium inline-flex items-center gap-1 px-2 py-1 rounded ${
                                  item.type === 'user'
                                    ? 'bg-purple-700 text-purple-100 hover:bg-purple-600'
                                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                }`}>
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

                            {item.contextExtractions && item.contextExtractions.length > 0 && (
                              <details className="cursor-pointer">
                                <summary className={`text-xs font-medium inline-flex items-center gap-1 px-2 py-1 rounded ${
                                  item.type === 'user'
                                    ? 'bg-green-700 text-green-100 hover:bg-green-600'
                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                }`}>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                  Extracted Papers ({item.contextExtractions.length})
                                </summary>
                                <div className="mt-2 space-y-1">
                                  {item.contextExtractions.map((extraction, extractionIndex) => (
                                    <div
                                      key={`${index}-extraction-${extraction.jobId}-${extractionIndex}`}
                                      className={`text-xs p-2 rounded ${
                                        item.type === 'user'
                                          ? 'bg-gray-700 text-gray-300'
                                          : 'bg-white border border-green-200'
                                      }`}
                                    >
                                      <div className="font-medium line-clamp-2">{extraction.fileName}</div>
                                      <div className={`text-xs mt-1 ${
                                        item.type === 'user' ? 'text-gray-400' : 'text-green-600'
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
                      <div className="mt-3 space-y-2">
                        {item.searchSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            onClick={() => handleSearchSuggestion(suggestion)}
                            className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
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
              {/* Invisible element for auto-scroll */}
              <div ref={messagesEndRef} />

              {isStageTwoInProgress && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-4 rounded-lg border bg-blue-50 border-blue-200">
                    <div className="text-sm text-blue-900 mb-2">
                      Stage 2: Searching for drug {searchProgress.current + 1} of {searchProgress.total}...
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${(searchProgress.current / searchProgress.total) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 border-t bg-background flex-shrink-0">
            <div className="max-w-2xl mx-auto">
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

              <div className="relative mt-4 group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-100 via-purple-100 to-pink-100 rounded-full blur opacity-0 group-hover:opacity-40 transition-opacity duration-500"></div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask a follow-up question..."
                    className="flex h-14 w-full rounded-full border border-gray-200 bg-white pl-6 pr-14 text-base shadow-sm transition-all duration-300 placeholder:text-gray-400 focus:border-blue-300/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!message.trim() || loading}
                    className="absolute right-2 h-10 w-10 rounded-full bg-gray-900 hover:bg-black disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-300 hover:scale-105 shadow-md text-white cursor-pointer"
                  >
                    {loading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-white" />
                    ) : (
                      <ArrowUp className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-1/2 bg-gray-50 overflow-hidden min-h-0">
          {selectedDrug ? (
            <DrugDetail
              drugGroup={selectedDrug}
              query={currentQuery}
              onBack={() => setSelectedDrug(null)}
              onExpandFullscreen={() => setShowDrugModal(true)}
              onAddPaperToContext={handleAddPaperToContext}
              isPaperInContext={isPaperInContext}
              onAddPressReleaseToContext={handleAddPressReleaseToContext}
              isPressReleaseInContext={isPressReleaseInContext}
            />
          ) : (
            <DrugsList
              drugGroups={drugGroups}
              loading={isStageTwoInProgress}
              query={currentQuery}
              onDrugClick={setSelectedDrug}
              onDrugSpecificSearch={handleDrugSpecificSearch}
              initialSearchQueries={initialSearchQueries}
            />
          )}
        </div>
      </div>

      {showDrugModal && selectedDrug && (
        <DrugDetailModal
          drugGroup={selectedDrug}
          query={currentQuery}
          onClose={() => setShowDrugModal(false)}
          onAddPaperToContext={handleAddPaperToContext}
          isPaperInContext={isPaperInContext}
          onAddPressReleaseToContext={handleAddPressReleaseToContext}
          isPressReleaseInContext={isPressReleaseInContext}
        />
      )}
    </div>
  )
})
