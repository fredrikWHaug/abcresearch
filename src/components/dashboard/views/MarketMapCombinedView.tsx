 
import React from 'react'
import { MarketMap } from '@/components/MarketMap'
import { SavedMaps } from '@/components/SavedMaps'
import type { ClinicalTrial } from '@/types/trials'
import type { SlideData } from '@/services/slideAPI'
import type { PubMedArticle } from '@/types/papers'
import type { ChatMessage } from '@/types/chat'
import type { SavedMarketMap } from '@/services/marketMapService'
import type { DrugGroup } from '@/services/drugGroupingService'

interface MarketMapCombinedViewProps {
  trials: ClinicalTrial[];
  loading: boolean;
  query: string;
  slideData: SlideData | null;
  setSlideData: React.Dispatch<React.SetStateAction<SlideData | null>>;
  generatingSlide: boolean;
  setGeneratingSlide: React.Dispatch<React.SetStateAction<boolean>>;
  slideError: string | null;
  setSlideError: React.Dispatch<React.SetStateAction<string | null>>;
  chatHistory: ChatMessage[];
  papers: PubMedArticle[];
  drugGroups: DrugGroup[];
  currentProjectId: number | null;
  onNavigateToResearch: () => void;
  onLoadMap: (map: SavedMarketMap) => Promise<void>;
  onDeleteMap: (_id: number) => void;
}

export function MarketMapCombinedView({
  trials,
  loading,
  query,
  slideData,
  setSlideData,
  generatingSlide,
  setGeneratingSlide,
  slideError,
  setSlideError,
  chatHistory,
  papers,
  drugGroups,
  currentProjectId,
  onNavigateToResearch,
  onLoadMap,
  onDeleteMap
}: MarketMapCombinedViewProps) {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      {/* Market Map Generator Section */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <MarketMap
          trials={trials}
          loading={loading}
          query={query}
          slideData={slideData}
          setSlideData={setSlideData}
          generatingSlide={generatingSlide}
          setGeneratingSlide={setGeneratingSlide}
          slideError={slideError}
          setSlideError={setSlideError}
          chatHistory={chatHistory}
          papers={papers}
          drugGroups={drugGroups}
          currentProjectId={currentProjectId}
          onSaveSuccess={() => {
            console.log('Market map saved successfully!')
          }}
          onNavigateToResearch={onNavigateToResearch}
        />
      </div>

      {/* Saved Market Maps Section */}
      <div className="border-t border-gray-200 bg-white">
        <div className="px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Saved Market Maps</h2>
          <div className="max-h-[300px] overflow-y-auto">
            <SavedMaps
              onLoadMap={onLoadMap}
              onDeleteMap={onDeleteMap}
              currentProjectId={currentProjectId}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

