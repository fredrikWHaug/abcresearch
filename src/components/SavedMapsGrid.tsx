/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MarketMapService, type SavedMarketMap } from '@/services/marketMapService';
import { Loader2, FolderOpen, Calendar, ArrowRight, Plus, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatedGradientBackground } from '@/components/AnimatedGradientBackground';

const MotionCard = motion(Card);

interface SavedMapsGridProps {
  onLoadMap: (map: SavedMarketMap) => void;
  onDeleteMap: (id: number) => void;
  currentProjectId?: number | null;
  hasNewSearchContent: boolean;
  onGenerateNewMap: () => void;
  refreshTrigger?: number;
}

export function SavedMapsGrid({
  onLoadMap,
  onDeleteMap: _onDeleteMap, // Reserved for future delete functionality
  currentProjectId,
  hasNewSearchContent,
  onGenerateNewMap,
  refreshTrigger
}: SavedMapsGridProps) {
  const [savedMaps, setSavedMaps] = useState<SavedMarketMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSavedMaps();
  }, [currentProjectId, refreshTrigger]);

  const loadSavedMaps = async () => {
    try {
      setLoading(true);
      setError(null);
      const maps = await MarketMapService.getUserMarketMaps(currentProjectId);
      setSavedMaps(maps);
    } catch (err) {
      console.error('Error loading saved maps:', err);
      setError(err instanceof Error ? err.message : 'Failed to load saved maps');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col relative">
        <AnimatedGradientBackground />
        <div className="flex-1 flex items-center justify-center px-6 relative z-10">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Almost there...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col relative">
        <AnimatedGradientBackground />
        <div className="flex-1 flex items-center justify-center px-6 relative z-10">
          <div className="text-center bg-white/70 backdrop-blur-xl rounded-3xl p-12 shadow-2xl border border-white/50">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={loadSavedMaps} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Animated Gradient Background */}
      <AnimatedGradientBackground />

      {/* Content */}
      <div className="px-6 py-10 max-w-7xl mx-auto w-full relative z-10">
        {/* Header with frosted glass effect */}
        <div className="mb-10 bg-white/60 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-white/50">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Your Market Maps
          </h1>
          <p className="text-gray-600 text-lg">
            {savedMaps.length} saved map{savedMaps.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Market Maps Grid */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          data-testid="market-maps-grid"
        >
          {/* Generate New Map Card */}
          <MotionCard
            className="border-2 border-dashed border-white/40 hover:border-blue-400/60 hover:shadow-2xl bg-white/40 backdrop-blur-xl cursor-pointer group relative overflow-hidden"
            onClick={hasNewSearchContent ? onGenerateNewMap : undefined}
            whileHover={hasNewSearchContent ? { scale: 1.05 } : undefined}
            transition={{ duration: 0.2, ease: "easeOut" }}
            data-testid="create-new-map-card"
          >
            <CardHeader className="flex flex-col items-center justify-center h-48 text-center relative z-10">
              <div className={`rounded-full p-4 mb-4 group-hover:scale-110 transition-all duration-300 shadow-lg ${
                hasNewSearchContent
                  ? 'bg-blue-100/60 backdrop-blur-sm group-hover:bg-blue-200/70'
                  : 'bg-gray-100/60 backdrop-blur-sm'
              }`}>
                <Plus className={`h-8 w-8 ${hasNewSearchContent ? 'text-blue-600' : 'text-gray-400'}`} />
              </div>
              <CardTitle className={`text-lg font-semibold mb-1 ${
                hasNewSearchContent ? 'text-gray-900' : 'text-gray-500'
              }`}>
                Generate New Map
              </CardTitle>
              <p className={`text-sm ${hasNewSearchContent ? 'text-gray-600' : 'text-gray-400'}`}>
                {hasNewSearchContent
                  ? 'Create from new search'
                  : 'Perform a new search first'}
              </p>
            </CardHeader>
            {/* Subtle gradient on hover */}
            <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
              hasNewSearchContent
                ? 'bg-linear-to-br from-blue-100/0 to-blue-100/0 group-hover:from-blue-100/40 group-hover:to-purple-100/30'
                : ''
            }`} />
          </MotionCard>

          {/* Existing Market Map Cards */}
          {savedMaps.map((map) => (
            <MotionCard
              key={map.id}
              className="group border border-white/50 hover:border-white/70 hover:shadow-2xl bg-white/50 backdrop-blur-xl cursor-pointer relative overflow-hidden"
              onClick={() => onLoadMap(map)}
              whileHover={{ scale: 1.05, y: -5 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              data-testid={`market-map-card-${map.id}`}
            >
              <CardHeader className="h-48 flex flex-col justify-between p-6 relative z-10">
                <div>
                  <div className="rounded-xl bg-linear-to-br from-blue-100/70 to-indigo-100/70 backdrop-blur-sm p-2 w-fit mb-4 group-hover:from-blue-200/80 group-hover:to-indigo-200/80 transition-all duration-300 shadow-lg">
                    <FileText className="h-5 w-5 text-blue-700" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-gray-900 line-clamp-2 mb-2 group-hover:text-blue-700 transition-colors">
                    {map.name}
                  </CardTitle>
                  {map.query && (
                    <p className="text-sm text-gray-600 line-clamp-1 mb-2">
                      {map.query}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {formatDate(map.updated_at)}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-500 group-hover:text-blue-700 group-hover:translate-x-2 transition-all" />
                </div>
              </CardHeader>
              {/* Dynamic gradient overlay on hover */}
              <div className="absolute inset-0 bg-linear-to-br from-blue-100/0 to-purple-100/0 group-hover:from-blue-100/30 group-hover:to-purple-100/30 transition-all duration-500 pointer-events-none" />
            </MotionCard>
          ))}
        </div>
      </div>
    </div>
  );
}
