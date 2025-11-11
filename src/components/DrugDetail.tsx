import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Maximize2 } from 'lucide-react';
import type { DrugGroup } from '@/services/drugGroupingService';
import type { PubMedArticle } from '@/types/papers';
import type { PressRelease } from '@/types/press-releases';
import { PapersDiscovery } from './PapersDiscovery';
import { TrialsList } from './TrialsList';
import { PressReleasesDiscovery } from './PressReleasesDiscovery';
import { IRDecksDiscovery } from './IRDecksDiscovery';

interface DrugDetailProps {
  drugGroup: DrugGroup;
  query: string;
  onBack: () => void;
  onExpandFullscreen: () => void;
  onAddPaperToContext?: (paper: PubMedArticle) => void;
  isPaperInContext?: (pmid: string) => boolean;
  onAddPressReleaseToContext?: (pressRelease: PressRelease) => void;
  isPressReleaseInContext?: (id: string) => boolean;
}

export function DrugDetail({
  drugGroup,
  query,
  onBack,
  onExpandFullscreen,
  onAddPaperToContext,
  isPaperInContext,
  onAddPressReleaseToContext,
  isPressReleaseInContext
}: DrugDetailProps) {
  const [activeTab, setActiveTab] = useState<'papers' | 'trials' | 'pressReleases' | 'irDecks'>('papers');

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Drugs
            </Button>
            <div className="h-6 w-px bg-gray-300"></div>
            <h2 className="text-xl font-bold text-gray-900">{drugGroup.drugName}</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onExpandFullscreen}
            className="hover:bg-gray-50"
          >
            <Maximize2 className="h-4 w-4 mr-2" />
            Expand Fullscreen
          </Button>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center justify-center mt-4">
          <div className="flex rounded-lg bg-gray-100 p-1 w-[40rem]">
            <button
              onClick={() => setActiveTab('papers')}
              className={`py-2 px-4 rounded-md text-sm font-medium transition-colors flex-1 text-center whitespace-nowrap ${
                activeTab === 'papers'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Papers ({drugGroup.papers.length})
            </button>
            <button
              onClick={() => setActiveTab('trials')}
              className={`py-2 px-4 rounded-md text-sm font-medium transition-colors flex-1 text-center whitespace-nowrap ${
                activeTab === 'trials'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Trials ({drugGroup.trials.length})
            </button>
            <button
              onClick={() => setActiveTab('pressReleases')}
              className={`py-2 px-4 rounded-md text-sm font-medium transition-colors flex-1 text-center whitespace-nowrap ${
                activeTab === 'pressReleases'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Press Releases ({drugGroup.pressReleases.length})
            </button>
            <button
              onClick={() => setActiveTab('irDecks')}
              className={`py-2 px-4 rounded-md text-sm font-medium transition-colors flex-1 text-center whitespace-nowrap ${
                activeTab === 'irDecks'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              IR Decks ({drugGroup.irDecks.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden bg-gray-50">
        {activeTab === 'papers' ? (
          <PapersDiscovery
            trials={drugGroup.trials}
            query={query}
            papers={drugGroup.papers}
            loading={false}
            onAddPaperToContext={onAddPaperToContext}
            isPaperInContext={isPaperInContext}
          />
        ) : activeTab === 'trials' ? (
          <TrialsList
            trials={drugGroup.trials}
            loading={false}
            query={query}
          />
        ) : activeTab === 'pressReleases' ? (
          <PressReleasesDiscovery
            pressReleases={drugGroup.pressReleases}
            query={query}
            loading={false}
            onAddPressReleaseToContext={onAddPressReleaseToContext}
            isPressReleaseInContext={isPressReleaseInContext}
          />
        ) : (
          <IRDecksDiscovery
            irDecks={drugGroup.irDecks}
            query={query}
            loading={false}
          />
        )}
      </div>
    </div>
  );
}

