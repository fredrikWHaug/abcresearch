 
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
      <div className="flex flex-wrap gap-2">
        {selectedPapers.map((paper) => (
          <div key={paper.pmid} className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-sm">
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
          <div key={pr.id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-md text-sm">
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
    <div className="relative context-panel-container">
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
              <div key={paper.pmid} className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
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
              <div key={pr.id} className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 bg-purple-50/30">
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
  )
}

interface ResearchSplitViewProps {
  chatHistory: ChatMessage[]
  selectedPapers: PubMedArticle[]
  selectedPressReleases: PressRelease[]
  showContextPanel: boolean
  onToggleContextPanel: () => void
  onRemovePaper: (pmid: string) => void
  onRemovePressRelease: (id: string) => void
  onClearContext: () => void
  onMessageChange: (value: string) => void
  onSendMessage: (messageOverride?: string) => void
  onKeyPress: (e: React.KeyboardEvent) => void
  handleSearchSuggestion: (suggestion: SearchSuggestion) => Promise<void>
  message: string
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

export function ResearchSplitView({
  chatHistory,
  selectedPapers,
  selectedPressReleases,
  showContextPanel,
  onToggleContextPanel,
  onRemovePaper,
  onRemovePressRelease,
  onClearContext,
  onMessageChange,
  onSendMessage,
  onKeyPress,
  handleSearchSuggestion,
  message,
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
  const isStageTwoInProgress = searchProgress.total > 0 && searchProgress.current < searchProgress.total
  const currentQuery = initialSearchQueries?.originalQuery || ''

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <div className="absolute w-px h-full bg-gray-200 z-10 top-0 pointer-events-none" style={{ left: '50%', transform: 'translateX(-0.5px)' }}></div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="w-1/2 bg-background flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-4">
              {chatHistory.map((item, index) => (
                <div
                  key={`${item.message}-${index}`}
                  className={`flex ${item.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-4 rounded-lg border ${
                      item.type === 'user'
                        ? 'bg-gray-800 text-white border-gray-700'
                        : 'bg-gray-50 text-gray-700 border-gray-200'
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
                        <div className="text-sm leading-relaxed">{item.message}</div>

                        {((item.contextPapers && item.contextPapers.length > 0) || (item.contextPressReleases && item.contextPressReleases.length > 0)) && (
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
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1ম2 13a2 2 0 01-2-2V7ম2 13a2 2 0 002-2V9a2 2 0 00-2-สองh-2ম-4-3H9M7 16h6M7 8h6v4H7V8z" />
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
                      <div className="mt-3 space-y-2">
                        {item.searchSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            onClick={() => handleSearchSuggestion(suggestion)}
                            className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
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
                showContextPanel={showContextPanel}
                onToggleContextPanel={onToggleContextPanel}
                onRemovePaper={onRemovePaper}
                onRemovePressRelease={onRemovePressRelease}
                onClearContext={onClearContext}
              />

              <div className="relative mt-3">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => onMessageChange(e.target.value)}
                  onKeyPress={onKeyPress}
                  placeholder="Respond to ABCresearch's agent..."
                  className="flex h-[50px] w-full rounded-md border border-gray-300 bg-white pl-4 pr-12 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => onSendMessage()}
                  disabled={!message.trim() || loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  <ArrowUp className="h-3 w-3 text-white" />
                </button>
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
}
