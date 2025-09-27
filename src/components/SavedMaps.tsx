import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MarketMapService, type SavedMarketMap } from '@/services/marketMapService';
import { Loader2, Trash2, Calendar, Search, FileText } from 'lucide-react';

interface SavedMapsProps {
  onLoadMap: (map: SavedMarketMap) => void;
  onDeleteMap: (id: number) => void;
}

export function SavedMaps({ onLoadMap, onDeleteMap }: SavedMapsProps) {
  const [savedMaps, setSavedMaps] = useState<SavedMarketMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    loadSavedMaps();
  }, []);

  const loadSavedMaps = async () => {
    try {
      setLoading(true);
      setError(null);
      const maps = await MarketMapService.getUserMarketMaps();
      setSavedMaps(maps);
    } catch (err) {
      console.error('Error loading saved maps:', err);
      setError(err instanceof Error ? err.message : 'Failed to load saved maps');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMap = async (id: number) => {
    if (!confirm('Are you sure you want to delete this market map?')) {
      return;
    }

    try {
      setDeletingId(id);
      await MarketMapService.deleteMarketMap(id);
      setSavedMaps(prev => prev.filter(map => map.id !== id));
      onDeleteMap(id);
    } catch (err) {
      console.error('Error deleting market map:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete market map');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading saved market maps...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={loadSavedMaps} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (savedMaps.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-semibold mb-2">No saved market maps</h3>
        <p className="text-sm">Generate and save your first market map to see it here.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Saved Market Maps</h2>
        <p className="text-gray-600">Load a previously saved market map to continue your analysis.</p>
      </div>

      <div className="grid gap-4 pb-6">
        {savedMaps.map((map) => (
          <Card key={map.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg line-clamp-2">{map.name}</CardTitle>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Search className="h-4 w-4" />
                      <span className="line-clamp-1">{map.query}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(map.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    onClick={() => onLoadMap(map)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    Load
                  </Button>
                  <Button
                    onClick={() => handleDeleteMap(map.id)}
                    variant="outline"
                    size="sm"
                    disabled={deletingId === map.id}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {deletingId === map.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Badge variant="secondary">
                  {map.trials_data.length} trials
                </Badge>
                <Badge variant="outline">
                  {map.slide_data.title}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
