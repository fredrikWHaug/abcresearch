import React, { useState } from 'react';
import { X, ChevronDown, ChevronRight, Pill, FileText, Activity, ExternalLink, Star, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DrugGroup, GroupedResults } from '@/services/drugGroupingService';
import type { ClinicalTrial } from '@/services/clinicalTrialsAPI';
import type { PubMedArticle } from '@/services/pubmedAPI';

interface DrugGroupedResultsProps {
  groupedResults: GroupedResults;
  onClose: () => void;
  query: string;
}

export const DrugGroupedResults: React.FC<DrugGroupedResultsProps> = ({ 
  groupedResults, 
  onClose,
  query 
}) => {
  const [expandedDrugs, setExpandedDrugs] = useState<Set<string>>(new Set([
    groupedResults.groups[0]?.normalizedName // Auto-expand first drug
  ].filter(Boolean)));
  
  const [expandedTrials, setExpandedTrials] = useState<Set<string>>(new Set());
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

  const toggleTrial = (nctId: string) => {
    const newExpanded = new Set(expandedTrials);
    if (newExpanded.has(nctId)) {
      newExpanded.delete(nctId);
    } else {
      newExpanded.add(nctId);
    }
    setExpandedTrials(newExpanded);
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

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Pill className="h-6 w-6 text-blue-600" />
              Results Grouped by Drug
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Search: "{query}" • {groupedResults.totalDrugs} drugs found
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-7xl mx-auto space-y-4">
          {groupedResults.groups.length === 0 ? (
            <div className="text-center py-12">
              <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No drug-specific results found</p>
              <p className="text-sm text-gray-500 mt-2">
                Try a more specific search query
              </p>
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
                expandedTrials={expandedTrials}
                onToggleTrial={toggleTrial}
                getCategoryColor={getCategoryColor}
                getRelevanceColor={getRelevanceColor}
              />
            ))
          )}

          {/* Ungrouped Results Section */}
          {(groupedResults.ungrouped.trials.length > 0 || 
            groupedResults.ungrouped.papers.length > 0) && (
            <Card className="border-2 border-dashed border-gray-300">
              <CardHeader>
                <CardTitle className="text-lg text-gray-600">
                  Other Results ({groupedResults.ungrouped.trials.length} trials, {groupedResults.ungrouped.papers.length} papers)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">
                  These results could not be associated with a specific drug intervention.
                </p>
              </CardContent>
            </Card>
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
  expandedTrials: Set<string>;
  onToggleTrial: (nctId: string) => void;
  getCategoryColor: (category?: string) => string;
  getRelevanceColor: (score: number) => string;
}

const DrugGroupCard: React.FC<DrugGroupCardProps> = ({
  group,
  isExpanded,
  onToggle,
  selectedTab,
  onTabChange,
  expandedTrials,
  onToggleTrial,
  getCategoryColor,
  getRelevanceColor
}) => {
  return (
    <Card className="border-2 border-gray-200 hover:shadow-lg transition-shadow">
      <CardHeader 
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-gray-600 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-600 flex-shrink-0" />
            )}
            <Pill className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <CardTitle className="text-xl">{group.drugName}</CardTitle>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge className={getCategoryColor(group.category)}>
              {group.category}
            </Badge>
            <Badge variant="outline" className="font-mono">
              <Activity className="h-3 w-3 mr-1" />
              {group.trials.length} trials
            </Badge>
            <Badge variant="outline" className="font-mono">
              <FileText className="h-3 w-3 mr-1" />
              {group.papers.length} papers
            </Badge>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="border-t bg-gray-50">
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabChange('trials');
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedTab === 'trials'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Clinical Trials ({group.trials.length})
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabChange('papers');
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedTab === 'papers'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Research Papers ({group.papers.length})
            </button>
          </div>

          {/* Content Area */}
          <div className="space-y-3">
            {selectedTab === 'trials' && (
              <>
                {group.trials.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No clinical trials found for this drug
                  </p>
                ) : (
                  group.trials.map((trial, index) => (
                    <TrialCard
                      key={trial.nctId}
                      trial={trial}
                      index={index}
                      isExpanded={expandedTrials.has(trial.nctId)}
                      onToggle={() => onToggleTrial(trial.nctId)}
                    />
                  ))
                )}
              </>
            )}

            {selectedTab === 'papers' && (
              <>
                {group.papers.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No research papers found for this drug
                  </p>
                ) : (
                  group.papers.map((paper) => (
                    <PaperCard
                      key={paper.pmid}
                      paper={paper}
                      getRelevanceColor={getRelevanceColor}
                    />
                  ))
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
  isExpanded: boolean;
  onToggle: () => void;
}

const TrialCard: React.FC<TrialCardProps> = ({ trial, index, isExpanded, onToggle }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div 
        className="p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          <Badge variant={index < 3 ? "default" : "secondary"} className="font-mono">
            #{index + 1}
          </Badge>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 hover:text-blue-600 transition-colors">
                  {trial.briefTitle}
                </h4>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {trial.nctId}
                  </Badge>
                  {trial.phase && trial.phase.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {trial.phase[0]}
                    </Badge>
                  )}
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      trial.overallStatus === 'RECRUITING' ? 'bg-green-50 text-green-700' : ''
                    }`}
                  >
                    {trial.overallStatus}
                  </Badge>
                </div>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
              )}
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t bg-gray-50 space-y-3">
          {trial.conditions && trial.conditions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Conditions:</p>
              <div className="flex flex-wrap gap-1">
                {trial.conditions.slice(0, 3).map((condition, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {condition}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {trial.sponsors?.lead && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Sponsor:</p>
              <p className="text-sm text-gray-600">{trial.sponsors.lead}</p>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            asChild
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <a 
              href={`https://clinicaltrials.gov/study/${trial.nctId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View on ClinicalTrials.gov
            </a>
          </Button>
        </div>
      )}
    </div>
  );
};

interface PaperCardProps {
  paper: PubMedArticle;
  getRelevanceColor: (score: number) => string;
}

const PaperCard: React.FC<PaperCardProps> = ({ paper, getRelevanceColor }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow p-4">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 line-clamp-2 mb-2">
            {paper.title}
          </h4>
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-600">
              {paper.authors.slice(0, 3).join(', ')}
              {paper.authors.length > 3 && ' et al.'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="outline" className="text-xs">{paper.journal}</Badge>
            <Badge variant="secondary" className="text-xs">{paper.publicationDate}</Badge>
            {paper.nctNumber && (
              <Badge variant="default" className="text-xs">{paper.nctNumber}</Badge>
            )}
          </div>
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {paper.abstract}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a 
                href={paper.fullTextLinks.pubmed}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                PubMed
              </a>
            </Button>
            {paper.fullTextLinks.doi && (
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a 
                  href={paper.fullTextLinks.doi}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  DOI
                </a>
              </Button>
            )}
          </div>
        </div>
        <Badge className={getRelevanceColor(paper.relevanceScore)}>
          <Star className="h-3 w-3 mr-1" />
          {paper.relevanceScore}%
        </Badge>
      </div>
    </div>
  );
};

