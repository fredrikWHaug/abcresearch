import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Pill, FileText, Activity, ExternalLink, Star, Users, Maximize2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DrugGroup, GroupedResults } from '@/services/drugGroupingService';
import type { ClinicalTrial } from '@/services/clinicalTrialsAPI';
import type { PubMedArticle } from '@/services/pubmedAPI';

interface DrugGroupedPanelProps {
  groupedResults: GroupedResults;
  onExpandFullScreen: () => void;
  loading: boolean;
}

export const DrugGroupedPanel: React.FC<DrugGroupedPanelProps> = ({ 
  groupedResults, 
  onExpandFullScreen,
  loading
}) => {
  const [expandedDrugs, setExpandedDrugs] = useState<Set<string>>(new Set([
    groupedResults.groups[0]?.normalizedName // Auto-expand first drug
  ].filter(Boolean)));
  
  const [selectedTab, setSelectedTab] = useState<Record<string, 'trials' | 'papers'>>({});

  const toggleDrug = (normalizedName: string) => {
    const newExpanded = new Set(expandedDrugs);
    if (newExpanded.has(normalizedName)) {
      newExpanded.delete(normalizedName);
    } else {
      newExpanded.add(normalizedName);
    }
    setExpandedDrugs(newExpanded);
  };

  const getTabForDrug = (normalizedName: string): 'trials' | 'papers' => {
    return selectedTab[normalizedName] || 'trials';
  };

  const setTabForDrug = (normalizedName: string, tab: 'trials' | 'papers') => {
    setSelectedTab({ ...selectedTab, [normalizedName]: tab });
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'Drug': return 'bg-blue-100 text-blue-800';
      case 'Biological': return 'bg-purple-100 text-purple-800';
      case 'Procedure': return 'bg-green-100 text-green-800';
      case 'Device': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Grouping results by drug...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with expand button */}
      <div className="flex-shrink-0 border-b bg-white px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Pill className="h-4 w-4 text-blue-600" />
            Grouped by Drug
          </h3>
          <p className="text-xs text-gray-600 mt-0.5">
            {groupedResults.totalDrugs} drugs found
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onExpandFullScreen}
          className="flex items-center gap-1"
        >
          <Maximize2 className="h-3 w-3" />
          Expand
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {groupedResults.groups.length === 0 ? (
            <div className="text-center py-12">
              <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No drug-specific results found</p>
            </div>
          ) : (
            groupedResults.groups.map((group) => (
              <DrugGroupCard
                key={group.normalizedName}
                group={group}
                isExpanded={expandedDrugs.has(group.normalizedName)}
                onToggle={() => toggleDrug(group.normalizedName)}
                selectedTab={getTabForDrug(group.normalizedName)}
                onTabChange={(tab) => setTabForDrug(group.normalizedName, tab)}
                getCategoryColor={getCategoryColor}
                getRelevanceColor={getRelevanceColor}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

interface DrugGroupCardProps {
  group: DrugGroup;
  isExpanded: boolean;
  onToggle: () => void;
  selectedTab: 'trials' | 'papers';
  onTabChange: (tab: 'trials' | 'papers') => void;
  getCategoryColor: (category?: string) => string;
  getRelevanceColor: (score: number) => string;
}

const DrugGroupCard: React.FC<DrugGroupCardProps> = ({
  group,
  isExpanded,
  onToggle,
  selectedTab,
  onTabChange,
  getCategoryColor,
  getRelevanceColor
}) => {
  return (
    <Card className="border border-gray-200">
      <CardHeader 
        className="cursor-pointer hover:bg-gray-50 transition-colors p-3"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-600 flex-shrink-0 mt-0.5" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-semibold truncate">{group.drugName}</CardTitle>
              <div className="flex items-center gap-1 mt-1">
                <Badge className={`${getCategoryColor(group.category)} text-xs px-1.5 py-0.5`}>
                  {group.category}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <Badge variant="outline" className="text-xs">
              {group.trials.length} trials
            </Badge>
            <Badge variant="outline" className="text-xs">
              {group.papers.length} papers
            </Badge>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="border-t bg-gray-50 p-3">
          {/* Tab Navigation */}
          <div className="flex gap-1 mb-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabChange('trials');
              }}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors flex-1 ${
                selectedTab === 'trials'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Trials ({group.trials.length})
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabChange('papers');
              }}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors flex-1 ${
                selectedTab === 'papers'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Papers ({group.papers.length})
            </button>
          </div>

          {/* Content Area */}
          <div className="space-y-2">
            {selectedTab === 'trials' && (
              <>
                {group.trials.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-2">
                    No trials found
                  </p>
                ) : (
                  group.trials.slice(0, 5).map((trial, index) => (
                    <TrialCard key={trial.nctId} trial={trial} index={index} />
                  ))
                )}
                {group.trials.length > 5 && (
                  <p className="text-xs text-gray-500 text-center py-1">
                    + {group.trials.length - 5} more trials
                  </p>
                )}
              </>
            )}

            {selectedTab === 'papers' && (
              <>
                {group.papers.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-2">
                    No papers found
                  </p>
                ) : (
                  group.papers.slice(0, 5).map((paper) => (
                    <PaperCard
                      key={paper.pmid}
                      paper={paper}
                      getRelevanceColor={getRelevanceColor}
                    />
                  ))
                )}
                {group.papers.length > 5 && (
                  <p className="text-xs text-gray-500 text-center py-1">
                    + {group.papers.length - 5} more papers
                  </p>
                )}
              </>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

interface TrialCardProps {
  trial: ClinicalTrial;
  index: number;
}

const TrialCard: React.FC<TrialCardProps> = ({ trial, index }) => {
  return (
    <div className="bg-white rounded border border-gray-200 p-2 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-2">
        <Badge variant={index < 3 ? "default" : "secondary"} className="text-xs px-1.5 py-0.5">
          #{index + 1}
        </Badge>
        <div className="flex-1 min-w-0">
          <a 
            href={`https://clinicaltrials.gov/study/${trial.nctId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-gray-900 hover:text-blue-600 line-clamp-2 block"
            onClick={(e) => e.stopPropagation()}
          >
            {trial.briefTitle}
          </a>
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge variant="outline" className="text-xs px-1 py-0">
              {trial.nctId}
            </Badge>
            {trial.phase && trial.phase.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1 py-0">
                {trial.phase[0]}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface PaperCardProps {
  paper: PubMedArticle;
  getRelevanceColor: (score: number) => string;
}

const PaperCard: React.FC<PaperCardProps> = ({ paper, getRelevanceColor }) => {
  return (
    <div className="bg-white rounded border border-gray-200 p-2 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <a 
            href={paper.fullTextLinks.pubmed}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-gray-900 hover:text-blue-600 line-clamp-2 block mb-1"
            onClick={(e) => e.stopPropagation()}
          >
            {paper.title}
          </a>
          <p className="text-xs text-gray-600 truncate mb-1">
            {paper.authors.slice(0, 2).join(', ')}
            {paper.authors.length > 2 && ' et al.'}
          </p>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-xs px-1 py-0">
              {paper.journal}
            </Badge>
            <Badge variant="secondary" className="text-xs px-1 py-0">
              {paper.publicationDate.split('-')[0]}
            </Badge>
          </div>
        </div>
        <Badge className={`${getRelevanceColor(paper.relevanceScore)} text-xs px-1.5 py-0.5 flex-shrink-0`}>
          {paper.relevanceScore}%
        </Badge>
      </div>
    </div>
  );
};

