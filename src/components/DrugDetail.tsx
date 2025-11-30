 
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Maximize2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="hover:bg-gray-100 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Drugs
            </Button>
            <div className="h-6 w-px bg-gray-300"></div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">{drugGroup.drugName}</h2>
              {drugGroup.hasBeenDeepDived && (
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                  Deep Searched
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onExpandFullscreen}
            className="hover:bg-gray-50 hover:shadow-md cursor-pointer shadow-sm border-gray-200 bg-white transition-all duration-200"
          >
            <Maximize2 className="h-4 w-4 mr-2" />
            Expand Fullscreen
          </Button>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center justify-center mt-4">
          <div className="flex rounded-full bg-gray-100 p-1.5 w-160 border border-gray-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('papers')}
              className={`rounded-full flex-1 cursor-pointer ${
                activeTab === 'papers'
                  ? 'bg-white text-blue-600 shadow-sm hover:bg-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              Papers ({drugGroup.papers.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('trials')}
              className={`rounded-full flex-1 cursor-pointer ${
                activeTab === 'trials'
                  ? 'bg-white text-purple-600 shadow-sm hover:bg-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              Trials ({drugGroup.trials.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('pressReleases')}
              className={`rounded-full flex-1 cursor-pointer ${
                activeTab === 'pressReleases'
                  ? 'bg-white text-pink-600 shadow-sm hover:bg-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              Press Releases ({drugGroup.pressReleases.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('irDecks')}
              className={`rounded-full flex-1 cursor-pointer ${
                activeTab === 'irDecks'
                  ? 'bg-white text-amber-600 shadow-sm hover:bg-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              IR Decks ({drugGroup.irDecks.length})
            </Button>
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

