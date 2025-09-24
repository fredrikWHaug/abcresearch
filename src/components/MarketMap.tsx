import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ClinicalTrial } from '@/services/clinicalTrialsAPI';
import { SlideAPI } from '@/services/slideAPI';
import type { SlideData } from '@/services/slideAPI';
import { Slide } from '@/components/Slide';
import { Building2, Calendar, Users, MapPin, Activity, FileText, Loader2 } from 'lucide-react';

interface MarketMapProps {
  trials: ClinicalTrial[];
  loading: boolean;
  query: string;
}

export function MarketMap({ trials, loading, query }: MarketMapProps) {
  const [slideData, setSlideData] = useState<SlideData | null>(null);
  const [generatingSlide, setGeneratingSlide] = useState(false);
  const [slideError, setSlideError] = useState<string | null>(null);

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
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Searching clinical trials...</p>
        </div>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="w-full h-full flex items-center justify-center">
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
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No trials found for: "{query}"</p>
          <p className="text-sm text-gray-500 mt-2">Try adjusting your search terms</p>
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
    <div className="w-full h-full flex flex-col max-h-full">
      <div className="flex-1 overflow-y-auto p-6 min-h-0 max-h-full">
        <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Market Map Results</h2>
              <p className="text-gray-600 mt-1">Found {trials.length} trials for: "{query}"</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleGenerateSlide}
                disabled={generatingSlide || trials.length === 0}
                className="flex items-center gap-2"
              >
                {generatingSlide ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Generate Slide
                  </>
                )}
              </Button>
              {slideError && (
                <p className="text-sm text-red-600 max-w-xs">{slideError}</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-0">
          {trials.map((trial) => (
            <Card key={trial.nctId} className="hover:shadow-md transition-shadow rounded-none border-b border-l border-r first:border-t last:rounded-b-md">
              <CardContent className="p-4">
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
        />
      )}
    </div>
  );
}
