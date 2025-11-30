 
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { DrugGroup } from '@/services/drugGroupingService';
import type { PubMedArticle } from '@/types/papers';
import type { PressRelease } from '@/types/press-releases';
import { PapersDiscovery } from './PapersDiscovery';
import { TrialsList } from './TrialsList';
import { PressReleasesDiscovery } from './PressReleasesDiscovery';
import { IRDecksDiscovery } from './IRDecksDiscovery';

interface DrugDetailModalProps {
  drugGroup: DrugGroup;
  query: string;
  onClose: () => void;
  onAddPaperToContext?: (paper: PubMedArticle) => void;
  isPaperInContext?: (pmid: string) => boolean;
  onAddPressReleaseToContext?: (pressRelease: PressRelease) => void;
  isPressReleaseInContext?: (id: string) => boolean;
}

export function DrugDetailModal({
  drugGroup,
  query,
  onClose,
  onAddPaperToContext,
  isPaperInContext,
  onAddPressReleaseToContext,
  isPressReleaseInContext
}: DrugDetailModalProps) {
  const [viewMode, setViewMode] = useState<'papers' | 'trials' | 'pressReleases' | 'irDecks' | 'both'>('both');

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0 rounded-t-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">{drugGroup.drugName}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center justify-center">
            <div className="flex rounded-full bg-gray-100 p-1.5 w-160 border border-gray-200">
              <button
                onClick={() => setViewMode('papers')}
                className={`py-2 px-3 rounded-full text-sm font-medium transition-all duration-300 flex-1 text-center whitespace-nowrap cursor-pointer ${
                  viewMode === 'papers'
                    ? 'bg-white text-blue-600 shadow-sm hover:bg-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                Papers ({drugGroup.papers.length})
              </button>
              <button
                onClick={() => setViewMode('trials')}
                className={`py-2 px-3 rounded-full text-sm font-medium transition-all duration-300 flex-1 text-center whitespace-nowrap cursor-pointer ${
                  viewMode === 'trials'
                    ? 'bg-white text-purple-600 shadow-sm hover:bg-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                Trials ({drugGroup.trials.length})
              </button>
              <button
                onClick={() => setViewMode('pressReleases')}
                className={`py-2 px-3 rounded-full text-sm font-medium transition-all duration-300 flex-1 text-center whitespace-nowrap cursor-pointer ${
                  viewMode === 'pressReleases'
                    ? 'bg-white text-pink-600 shadow-sm hover:bg-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                Press ({drugGroup.pressReleases.length})
              </button>
              <button
                onClick={() => setViewMode('irDecks')}
                className={`py-2 px-3 rounded-full text-sm font-medium transition-all duration-300 flex-1 text-center whitespace-nowrap cursor-pointer ${
                  viewMode === 'irDecks'
                    ? 'bg-white text-amber-600 shadow-sm hover:bg-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                IR Decks ({drugGroup.irDecks.length})
              </button>
              <button
                onClick={() => setViewMode('both')}
                className={`py-2 px-3 rounded-full text-sm font-medium transition-all duration-300 flex-1 text-center whitespace-nowrap cursor-pointer ${
                  viewMode === 'both'
                    ? 'bg-white text-gray-900 shadow-sm hover:bg-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                Side by Side
              </button>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'both' ? (
            <div className="flex h-full">
              {/* Left: Papers */}
              <div className="w-1/2 border-r border-gray-200 bg-gray-50">
                <div className="h-full flex flex-col">
                  <div className="bg-white border-b border-gray-200 px-6 py-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Research Papers ({drugGroup.papers.length})
                    </h3>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <PapersDiscovery
                      trials={drugGroup.trials}
                      query={query}
                      papers={drugGroup.papers}
                      loading={false}
                      onAddPaperToContext={onAddPaperToContext}
                      isPaperInContext={isPaperInContext}
                    />
                  </div>
                </div>
              </div>

              {/* Right: Trials */}
              <div className="w-1/2 bg-gray-50">
                <div className="h-full flex flex-col">
                  <div className="bg-white border-b border-gray-200 px-6 py-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Clinical Trials ({drugGroup.trials.length})
                    </h3>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <TrialsList
                      trials={drugGroup.trials}
                      loading={false}
                      query={query}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : viewMode === 'papers' ? (
            <div className="h-full bg-gray-50">
              <PapersDiscovery
                trials={drugGroup.trials}
                query={query}
                papers={drugGroup.papers}
                loading={false}
                onAddPaperToContext={onAddPaperToContext}
                isPaperInContext={isPaperInContext}
              />
            </div>
          ) : viewMode === 'trials' ? (
            <div className="h-full bg-gray-50">
              <TrialsList
                trials={drugGroup.trials}
                loading={false}
                query={query}
              />
            </div>
          ) : viewMode === 'pressReleases' ? (
            <div className="h-full bg-gray-50">
              <PressReleasesDiscovery
                pressReleases={drugGroup.pressReleases}
                query={query}
                loading={false}
                onAddPressReleaseToContext={onAddPressReleaseToContext}
                isPressReleaseInContext={isPressReleaseInContext}
              />
            </div>
          ) : (
            <div className="h-full bg-gray-50">
              <IRDecksDiscovery
                irDecks={drugGroup.irDecks}
                query={query}
                loading={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

