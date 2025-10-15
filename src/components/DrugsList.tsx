import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Pill, FileText, FlaskConical } from 'lucide-react';
import type { DrugGroup } from '@/services/drugGroupingService';

interface DrugsListProps {
  drugGroups: DrugGroup[];
  loading: boolean;
  query: string;
  onDrugClick: (drugGroup: DrugGroup) => void;
}

export function DrugsList({ drugGroups, loading, query, onDrugClick }: DrugsListProps) {
  const [hoveredDrug, setHoveredDrug] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading drug data...</p>
        </div>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <Pill className="h-12 w-12 mx-auto mb-3 text-gray-400" />
          <p>Enter a search query to explore drugs</p>
          <p className="text-sm mt-2">Try: "GLP-1 agonists for diabetes"</p>
        </div>
      </div>
    );
  }

  if (drugGroups.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No drugs found for: "{query}"</p>
          <p className="text-sm text-gray-500 mt-2">Try adjusting your search terms</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Drugs Found ({drugGroups.length})
            </h2>
            <p className="text-gray-600 mt-1">
              Click on a drug to view related papers and clinical trials
            </p>
          </div>

          {/* Drug Cards */}
          <div className="space-y-3">
            {drugGroups.map((drugGroup) => (
              <Card
                key={drugGroup.normalizedName}
                className={`hover:shadow-lg transition-all cursor-pointer border-2 ${
                  hoveredDrug === drugGroup.normalizedName
                    ? 'border-blue-500 shadow-md'
                    : 'border-transparent'
                }`}
                onClick={() => onDrugClick(drugGroup)}
                onMouseEnter={() => setHoveredDrug(drugGroup.normalizedName)}
                onMouseLeave={() => setHoveredDrug(null)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    {/* Left: Drug Info */}
                    <div className="flex items-center gap-4 flex-1">
                      {/* Icon */}
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Pill className="h-6 w-6 text-blue-600" />
                      </div>

                      {/* Drug Name and Stats */}
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {drugGroup.drugName}
                        </h3>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                              <span className="font-semibold text-gray-900">
                                {drugGroup.papers.length}
                              </span>{' '}
                              paper{drugGroup.papers.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <FlaskConical className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                              <span className="font-semibold text-gray-900">
                                {drugGroup.trials.length}
                              </span>{' '}
                              trial{drugGroup.trials.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Total Badge and Arrow */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">
                        {drugGroup.totalResults} total
                      </Badge>
                      <ChevronRight
                        className={`h-5 w-5 text-gray-400 transition-transform ${
                          hoveredDrug === drugGroup.normalizedName
                            ? 'translate-x-1 text-blue-600'
                            : ''
                        }`}
                      />
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

