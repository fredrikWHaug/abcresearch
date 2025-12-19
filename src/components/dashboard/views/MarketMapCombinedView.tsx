
import React, { useState, useEffect } from 'react'
import { MarketMap } from '@/components/MarketMap'
import { SavedMapsGrid } from '@/components/SavedMapsGrid'
import { MarketMapService, type SavedMarketMap } from '@/services/marketMapService'
import type { ClinicalTrial } from '@/types/trials'
import type { SlideData } from '@/services/slideAPI'
import type { PubMedArticle } from '@/types/papers'
import type { ChatMessage } from '@/types/chat'
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
  const [showGeneratorView, setShowGeneratorView] = useState(false)
  const [savedMapsCount, setSavedMapsCount] = useState(0)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [hasSavedMaps, setHasSavedMaps] = useState(false)
  const [isLoadingMaps, setIsLoadingMaps] = useState(true)

  // Determine if there's new search content available for generating a map
  const hasNewSearchContent = trials.length > 0 && query.length > 0

  // Check if there are saved maps on mount and when project changes
  useEffect(() => {
    const checkSavedMaps = async () => {
      try {
        setIsLoadingMaps(true)
        const maps = await MarketMapService.getUserMarketMaps(currentProjectId)
        setSavedMapsCount(maps.length)
        setHasSavedMaps(maps.length > 0)

        // If no saved maps exist and we have search results, show generator
        if (maps.length === 0 && (trials.length > 0 || query)) {
          setShowGeneratorView(true)
        } else if (maps.length > 0 && !hasNewSearchContent) {
          // If saved maps exist and no new search, default to showing the grid
          setShowGeneratorView(false)
        }
      } catch (error) {
        console.error('Error checking saved maps:', error)
      } finally {
        setIsLoadingMaps(false)
      }
    }

    checkSavedMaps()
  }, [currentProjectId, refreshTrigger, hasNewSearchContent])

  const handleGenerateNewMap = () => {
    if (hasNewSearchContent) {
      setShowGeneratorView(true)
    }
  }

  const handleSaveSuccess = () => {
    console.log('Market map saved successfully!')
    // Trigger refresh of saved maps grid
    setRefreshTrigger(prev => prev + 1)
    // After save, show the saved maps grid
    setShowGeneratorView(false)
    // Force re-fetch of maps
    setHasSavedMaps(true)
  }

  // Show loading spinner while checking for saved maps
  if (isLoadingMaps) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your market maps...</p>
          </div>
        </div>
      </div>
    )
  }

  // If we should show the saved maps grid
  // IMPORTANT: Only show grid if no slide is currently loaded
  if (hasSavedMaps && !showGeneratorView && !slideData) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <SavedMapsGrid
          onLoadMap={onLoadMap}
          onDeleteMap={onDeleteMap}
          currentProjectId={currentProjectId}
          hasNewSearchContent={hasNewSearchContent}
          onGenerateNewMap={handleGenerateNewMap}
          refreshTrigger={refreshTrigger}
        />
      </div>
    )
  }

  // Otherwise show the generator view
  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
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
          onSaveSuccess={handleSaveSuccess}
          onNavigateToResearch={onNavigateToResearch}
        />
      </div>
    </div>
  )
}
