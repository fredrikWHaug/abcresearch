import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ClinicalTrial } from '@/services/clinicalTrialsAPI';

interface TrialsListProps {
  trials: ClinicalTrial[];
  loading: boolean;
  query: string;
}

export function TrialsList({ trials, loading, query }: TrialsListProps) {
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
          <h2 className="text-2xl font-semibold mb-2">Clinical Trials List</h2>
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

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-gray-800">
              {trials.length} clinical trials found for your search
            </h2>
          </div>

          <div className="space-y-0">
            {trials.map((trial: any, index) => (
              <Card key={trial.nctId} className="hover:shadow-md transition-shadow rounded-none border-b border-l border-r first:border-t last:rounded-b-md">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Ranking badge */}
                    <div className="flex-shrink-0">
                      <Badge variant={index < 3 ? "default" : "secondary"} className="font-mono">
                        #{index + 1}
                      </Badge>
                    </div>
                    
                    {/* Trial content */}
                    <div className="flex-1">
                      <a 
                        href={`https://clinicaltrials.gov/study/${trial.nctId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
                      >
                        <div className="text-lg font-medium hover:text-blue-600 transition-colors">
                          {trial.briefTitle}
                        </div>
                      </a>
                      {trial.rankScore && (
                        <div className="text-xs text-gray-500 mt-1">
                          Match score: {trial.rankScore}%
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
    </div>
  );
}
