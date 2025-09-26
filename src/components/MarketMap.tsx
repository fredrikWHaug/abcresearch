import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ClinicalTrial } from '@/services/clinicalTrialsAPI';
import { SlideAPI } from '@/services/slideAPI';
import type { SlideData } from '@/services/slideAPI';
import { MarketMapService } from '@/services/marketMapService';
import { Slide } from '@/components/Slide';
import { Building2, Calendar, Users, MapPin, Activity, FileText, Loader2, Save, X } from 'lucide-react';

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
  onSaveSuccess?: () => void;
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
  onSaveSuccess
}: MarketMapProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleGenerateSlide = async () => {
    if (trials.length === 0) return;
    
    setGeneratingSlide(true);
    setSlideError(null);
    
    try {
      const slide = await SlideAPI.generateSlide(trials, query);
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
      await MarketMapService.saveMarketMap({
        name: saveName.trim(),
        query,
        trials_data: trials,
        slide_data: slideData,
      });
      
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

  if (!query) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-0">
        <div className="text-center text-gray-500">
          <Activity className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-2xl font-semibold mb-2">Clinical Trials Market Map</h2>
          <p>Enter a search query to explore clinical trials data</p>
          <p className="text-sm mt-2">Try: "Phase 2 oncology trials by Pfizer"</p>
        </div>
      </div>
    );
  }

  if (trials.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-0">
        <div className="text-center">
          <p className="text-gray-600">No trials found for: "{query}"</p>
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
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <FileText className="h-5 w-5 mr-2" />
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
          onSaveSuccess={onSaveSuccess}
        />
      )}

      {/* Save Dialog Modal */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
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
                  className="bg-green-600 hover:bg-green-700 text-white"
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
