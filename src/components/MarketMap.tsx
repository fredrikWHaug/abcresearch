/* eslint-disable */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ClinicalTrial } from '@/types/trials';
import { SlideAPI } from '@/services/slideAPI';
import type { SlideData } from '@/services/slideAPI';
import { MarketMapService } from '@/services/marketMapService';
import { Slide } from '@/components/Slide';
import { Building2, Calendar, Users, MapPin, Activity, Loader2, Save, X } from 'lucide-react';
import type { DrugGroup } from '@/services/drugGroupingService';

interface MarketMapProps {
  trials: ClinicalTrial[];
  loading: boolean;
  query: string;
  slideData: SlideData | null;
  setSlideData: (data: SlideData | null) => void;
  generatingSlide: boolean;
  setGeneratingSlide: (generating: boolean) => void;
  slideError: string | null;
  setSlideError: (error: string | null) => void;
  chatHistory: Array<{type: 'user' | 'system', message: string, searchSuggestions?: Array<{id: string, label: string, query: string, description?: string}>}>;
  papers: any[];
  drugGroups: DrugGroup[];
  currentProjectId: number | null;
  onSaveSuccess?: () => void;
  onNavigateToResearch?: () => void;
}

export function MarketMap({ 
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
  onSaveSuccess,
  onNavigateToResearch
}: MarketMapProps) {
  console.log('MarketMap component received props:', {
    chatHistory,
    papers,
    drugGroups,
    chatHistoryLength: chatHistory?.length,
    papersLength: papers?.length,
    drugGroupsLength: drugGroups?.length,
    chatHistoryType: typeof chatHistory,
    papersType: typeof papers
  });
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleGenerateSlide = async () => {
    // Use drugGroups if available, otherwise fall back to trials
    if (drugGroups.length === 0 && trials.length === 0) return;
    
    setGeneratingSlide(true);
    setSlideError(null);
    
    try {
      // Pass drugGroups to the slide generation API
      const slide = await SlideAPI.generateSlide(trials, query, drugGroups);
      setSlideData(slide);
    } catch (error) {
      console.error('Error generating slide:', error);
      setSlideError(error instanceof Error ? error.message : 'Failed to generate slide');
    } finally {
      setGeneratingSlide(false);
    }
  };

  const handleCloseSlide = () => {
    setSlideData(null);
    setSlideError(null);
  };

  const handleSaveMarketMap = async () => {
    if (!slideData || !saveName.trim()) return;
    
    setSaving(true);
    setSaveError(null);
    
    try {
      console.log('=== SAVE FUNCTION DEBUG ===');
      console.log('chatHistory prop:', chatHistory);
      console.log('papers prop:', papers);
      console.log('chatHistory type:', typeof chatHistory);
      console.log('papers type:', typeof papers);
      console.log('chatHistory length:', chatHistory?.length);
      console.log('papers length:', papers?.length);
      
      console.log('Saving market map with data:', {
        name: saveName.trim(),
        query,
        trials_count: trials.length,
        slide_data: slideData,
        chat_history_count: chatHistory?.length || 0,
        papers_count: papers?.length || 0,
        chat_history: chatHistory,
        papers_data: papers,
      });
      
      // If we're working on an existing project, update it instead of creating new
      if (currentProjectId) {
        console.log('Updating existing project:', currentProjectId);
        await MarketMapService.updateMarketMap(currentProjectId, {
          name: saveName.trim(),
          query,
          trials_data: trials,
          slide_data: slideData,
          chat_history: chatHistory,
          papers_data: papers,
        });
      } else {
        console.log('Creating new market map');
        await MarketMapService.saveMarketMap({
          name: saveName.trim(),
          query,
          trials_data: trials,
          slide_data: slideData,
          chat_history: chatHistory,
          papers_data: papers,
        }, currentProjectId);
      }
      
      setShowSaveDialog(false);
      setSaveName('');
      onSaveSuccess?.();
    } catch (error) {
      console.error('Error saving market map:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save market map');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSaveDialog = () => {
    setSaveName(slideData?.title || `Market Map - ${query}`);
    setShowSaveDialog(true);
    setSaveError(null);
  };
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-0">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Searching clinical trials...</p>
        </div>
      </div>
    );
  }

  // Only show "search required" message if there's no query AND no trials AND no existing slide data
  if (!query && trials.length === 0 && !slideData) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-0">
        <div className="text-center text-gray-500">
          <p className="mb-6">The market map generator will be available when a search has been completed.</p>
          {onNavigateToResearch && (
            <Button
              onClick={onNavigateToResearch}
              className="border border-white/50 hover:border-white/70 bg-white/50 backdrop-blur-xl hover:shadow-2xl text-gray-900 px-6 py-3 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 hover:scale-105"
            >
              Start Research
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (trials.length === 0 && !slideData) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-0">
        <div className="text-center">
          <p className="text-gray-600">No trials found{query ? ` for: "${query}"` : ''}</p>
          <p className="text-sm text-gray-500 mt-2">Try adjusting your search terms</p>
        </div>
      </div>
    );
  }

  // Show loading state when generating slide
  if (generatingSlide) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-0">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Generating market analysis...</p>
        </div>
      </div>
    );
  }

  // Show centered generate button when trials exist but no slide has been generated
  if (trials.length > 0 && !slideData) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-0">
        <div className="text-center">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Market Analysis Ready</h2>
            <p className="text-gray-600 text-lg">Found {trials.length} clinical trials for analysis</p>
          </div>
          <Button
            onClick={handleGenerateSlide}
            className="border border-white/50 hover:border-white/70 bg-white/50 backdrop-blur-xl hover:shadow-2xl text-gray-900 px-8 py-4 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 hover:scale-105"
          >
            Generate Market Map
          </Button>
        </div>
      </div>
    );
  }

  const getPhaseColor = (phase?: string[]) => {
    if (!phase || phase.length === 0) return 'bg-gray-100 text-gray-700';
    const phaseStr = phase[0];
    if (phaseStr.includes('3')) return 'bg-green-100 text-green-700';
    if (phaseStr.includes('2')) return 'bg-blue-100 text-blue-700';
    if (phaseStr.includes('1')) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'RECRUITING':
        return 'bg-green-100 text-green-700';
      case 'COMPLETED':
        return 'bg-gray-100 text-gray-700';
      case 'ACTIVE_NOT_RECRUITING':
        return 'bg-blue-100 text-blue-700';
      case 'TERMINATED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 min-h-0 max-h-full">
        <div className="max-w-7xl mx-auto">
        <div className="mb-6 text-center">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">
              {trials.length} clinical trials found for your search
            </h2>
            {slideData && (
              <Button
                onClick={handleOpenSaveDialog}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Map
              </Button>
            )}
          </div>
          {slideError && (
            <div className="mt-2">
              <p className="text-sm text-red-600">{slideError}</p>
            </div>
          )}
        </div>

        <div className="space-y-0">
          {trials.map((trial: any, index) => (
            <Card key={trial.nctId} className="hover:shadow-md transition-shadow rounded-none border-b border-l border-r first:border-t last:rounded-b-md">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Ranking indicator */}
                  <div className="flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      #{index + 1}
                    </div>
                    {trial.rankScore && (
                      <div className="text-xs text-center mt-1 text-gray-500">
                        {trial.rankScore}%
                      </div>
                    )}
                  </div>
                  
                  {/* Trial content */}
                  <div className="flex-1">
                    <a 
                      href={`https://clinicaltrials.gov/study/${trial.nctId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
                    >
                      <CardTitle className="text-lg line-clamp-2 hover:text-blue-600 transition-colors">
                        {trial.briefTitle}
                      </CardTitle>
                    </a>
                    {trial.rankReasons && trial.rankReasons.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {trial.rankReasons.map((reason: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {reason}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {/* Trial metadata and drug badges */}
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {trial.nctId && (
                        <span className="text-xs text-gray-500 font-mono">
                          {trial.nctId}
                        </span>
                      )}
                      {/* Drug keywords extracted by Gemini from this trial */}
                      {trial.extractedDrugs && trial.extractedDrugs.slice(0, 3).map((drug: string, idx: number) => (
                        <Badge 
                          key={idx}
                          className="text-xs bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
                          variant="outline"
                        >
                          {drug}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        </div>
      </div>

      {/* Slide Modal */}
      {slideData && (
        <Slide
          slideData={slideData}
          onClose={handleCloseSlide}
          query={query}
          trials={trials}
          chatHistory={chatHistory}
          papers={papers}
          currentProjectId={currentProjectId}
          onSaveSuccess={onSaveSuccess}
        />
      )}

      {/* Save Dialog Modal */}
      {showSaveDialog && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 border shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Save Market Map</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSaveDialog(false)}
                className="p-1"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Map Name
                </label>
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Enter a name for your market map"
                  className="w-full"
                />
              </div>
              
              {saveError && (
                <div className="text-sm text-red-600">
                  {saveError}
                </div>
              )}
              
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowSaveDialog(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveMarketMap}
                  disabled={saving || !saveName.trim()}
                  className="border border-white/50 hover:border-white/70 bg-white/50 backdrop-blur-xl hover:shadow-2xl text-gray-900 transition-all duration-200"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
