/* eslint-disable */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Calendar, TestTube, PlayCircle, CheckCircle } from 'lucide-react';
import type { ClinicalTrial } from '@/types/trials';

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
                      
                      {/* Trial metadata */}
                      <div className="mt-3 flex flex-wrap gap-4 text-sm">
                        {/* Sponsor */}
                        {trial.sponsors?.lead && (
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <Building2 className="h-4 w-4 flex-shrink-0" />
                            <span className="font-medium">{trial.sponsors.lead}</span>
                          </div>
                        )}
                        
                        {/* Phase */}
                        {trial.phase && trial.phase.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <TestTube className="h-4 w-4 flex-shrink-0 text-purple-600" />
                            <Badge variant="outline" className="text-xs">
                              {trial.phase.join(', ')}
                            </Badge>
                          </div>
                        )}
                        
                        {/* Start Date */}
                        {trial.startDate && (
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <PlayCircle className="h-4 w-4 flex-shrink-0 text-green-600" />
                            <span className="text-xs">
                              Started: {new Date(trial.startDate).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        )}
                        
                        {/* Completion Date */}
                        {trial.completionDate && (
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <CheckCircle className="h-4 w-4 flex-shrink-0 text-blue-600" />
                            <span className="text-xs">
                              {trial.overallStatus === 'COMPLETED' ? 'Completed' : 'Expected'}: {new Date(trial.completionDate).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Rank score and status badge */}
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {trial.rankScore && (
                          <Badge variant="secondary" className="text-xs">
                            Match: {trial.rankScore}%
                          </Badge>
                        )}
                        {trial.overallStatus && (
                          <Badge 
                            variant={
                              trial.overallStatus === 'RECRUITING' ? 'default' : 
                              trial.overallStatus === 'COMPLETED' ? 'secondary' : 
                              'outline'
                            }
                            className="text-xs"
                          >
                            {trial.overallStatus.replace(/_/g, ' ')}
                          </Badge>
                        )}
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
    </div>
  );
}
