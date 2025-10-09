import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, FileText, ExternalLink, Star, Users, Pill, TestTube } from 'lucide-react';
import type { PubMedArticle } from '@/services/pubmedAPI';
import type { ClinicalTrial } from '@/services/clinicalTrialsAPI';
import type { GroupedResults as GroupedResultsType } from '@/services/groupUniqueDrugs';

interface GroupedResultsProps {
  groupedResults: GroupedResultsType;
  userQuery: string;
  loading: boolean;
}

export const GroupedResults: React.FC<GroupedResultsProps> = ({ 
  groupedResults, 
  userQuery, 
  loading 
}) => {
  const [expandedDrugs, setExpandedDrugs] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Debug logging
  console.log('🔍 GroupedResults received:', {
    groupedResults,
    userQuery,
    loading,
    hasGroupedResults: !!groupedResults,
    drugGroupsLength: groupedResults?.drugGroups?.length || 0,
    totalTrials: groupedResults?.totalTrials || 0,
    totalPapers: groupedResults?.totalPapers || 0
  });

  const toggleDrugExpansion = (drugName: string) => {
    const newExpanded = new Set(expandedDrugs);
    if (newExpanded.has(drugName)) {
      newExpanded.delete(drugName);
    } else {
      newExpanded.add(drugName);
    }
    setExpandedDrugs(newExpanded);
  };

  const handleItemSelect = (itemId: string, type: 'trial' | 'paper') => {
    const newSelected = new Set(selectedItems);
    const fullId = `${type}-${itemId}`;
    if (newSelected.has(fullId)) {
      newSelected.delete(fullId);
    } else {
      newSelected.add(fullId);
    }
    setSelectedItems(newSelected);
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-blue-100 text-blue-800';
    if (confidence >= 60) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Grouping results by drug interventions...</p>
        </div>
      </div>
    );
  }

  if (!groupedResults || (groupedResults.drugGroups.length === 0 && groupedResults.ungroupedTrials.length === 0 && groupedResults.ungroupedPapers.length === 0)) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No results found for: "{userQuery}"</p>
          <p className="text-sm text-gray-500 mt-2">Try adjusting your search terms</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with summary */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Search Results</h3>
            <p className="text-sm text-gray-600">
              {groupedResults.totalDrugs} drug groups • {groupedResults.totalTrials} trials • {groupedResults.totalPapers} papers
            </p>
          </div>
          {selectedItems.size > 0 && (
            <Button variant="outline" size="sm">
              Export Selected ({selectedItems.size})
            </Button>
          )}
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Drug Groups */}
          {groupedResults.drugGroups.map((drugGroup) => (
            <Card key={drugGroup.drugName} className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleDrugExpansion(drugGroup.drugName)}
                      className="p-1 h-6 w-6"
                    >
                      {expandedDrugs.has(drugGroup.drugName) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <Pill className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">{drugGroup.drugName}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getRelevanceColor(drugGroup.matchScore)}>
                      <Star className="h-3 w-3 mr-1" />
                      {drugGroup.matchScore}% match
                    </Badge>
                    <Badge className={getConfidenceColor(drugGroup.drugInfo.confidence)}>
                      {drugGroup.drugInfo.confidence}% confidence
                    </Badge>
                    <Badge variant="outline">
                      {drugGroup.totalCount} results
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              {expandedDrugs.has(drugGroup.drugName) && (
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {/* Clinical Trials */}
                    {drugGroup.trials.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <TestTube className="h-4 w-4" />
                          Clinical Trials ({drugGroup.trials.length})
                        </h4>
                        <div className="space-y-2">
                          {drugGroup.trials.map((trial) => (
                            <Card 
                              key={trial.nctId}
                              className={`hover:shadow-md transition-shadow cursor-pointer ${
                                selectedItems.has(`trial-${trial.nctId}`) ? 'ring-2 ring-blue-500' : ''
                              }`}
                              onClick={() => handleItemSelect(trial.nctId, 'trial')}
                            >
                              <CardContent className="p-3">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-sm line-clamp-2 mb-1">
                                      {trial.briefTitle}
                                    </h5>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      <Badge variant="outline" className="text-xs">
                                        {trial.overallStatus}
                                      </Badge>
                                      {trial.phase && trial.phase.length > 0 && (
                                        <Badge variant="secondary" className="text-xs">
                                          {trial.phase.join(', ')}
                                        </Badge>
                                      )}
                                      {trial.enrollment && (
                                        <Badge variant="outline" className="text-xs">
                                          N={trial.enrollment}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-600 line-clamp-2">
                                      {trial.conditions?.join(', ')}
                                    </p>
                                  </div>
                                  <div className="ml-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      asChild
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <a 
                                        href={`https://clinicaltrials.gov/ct2/show/${trial.nctId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Research Papers */}
                    {drugGroup.papers.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Research Papers ({drugGroup.papers.length})
                        </h4>
                        <div className="space-y-2">
                          {drugGroup.papers.map((paper) => (
                            <Card 
                              key={paper.pmid}
                              className={`hover:shadow-md transition-shadow cursor-pointer ${
                                selectedItems.has(`paper-${paper.pmid}`) ? 'ring-2 ring-blue-500' : ''
                              }`}
                              onClick={() => handleItemSelect(paper.pmid, 'paper')}
                            >
                              <CardContent className="p-3">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-sm line-clamp-2 mb-1">
                                      {paper.title}
                                    </h5>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Users className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground">
                                        {paper.authors.slice(0, 2).join(', ')}
                                        {paper.authors.length > 2 && ' et al.'}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      <Badge variant="outline" className="text-xs">
                                        {paper.journal}
                                      </Badge>
                                      <Badge variant="secondary" className="text-xs">
                                        {paper.publicationDate}
                                      </Badge>
                                      <Badge className={getRelevanceColor(paper.relevanceScore)}>
                                        <Star className="h-3 w-3 mr-1" />
                                        {paper.relevanceScore}%
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-gray-600 line-clamp-2">
                                      {paper.abstract}
                                    </p>
                                  </div>
                                  <div className="ml-2 flex flex-col gap-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      asChild
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <a 
                                        href={paper.fullTextLinks.pubmed}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </Button>
                                    {paper.fullTextLinks.doi && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <a 
                                          href={paper.fullTextLinks.doi}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          DOI
                                        </a>
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}

          {/* Ungrouped Results */}
          {(groupedResults.ungroupedTrials.length > 0 || groupedResults.ungroupedPapers.length > 0) && (
            <Card className="border-l-4 border-l-gray-400">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleDrugExpansion('ungrouped')}
                      className="p-1 h-6 w-6"
                    >
                      {expandedDrugs.has('ungrouped') ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <CardTitle className="text-lg text-gray-600">Other Results</CardTitle>
                  </div>
                  <Badge variant="outline">
                    {groupedResults.ungroupedTrials.length + groupedResults.ungroupedPapers.length} results
                  </Badge>
                </div>
              </CardHeader>

              {expandedDrugs.has('ungrouped') && (
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {/* Ungrouped Clinical Trials */}
                    {groupedResults.ungroupedTrials.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <TestTube className="h-4 w-4" />
                          Clinical Trials ({groupedResults.ungroupedTrials.length})
                        </h4>
                        <div className="space-y-2">
                          {groupedResults.ungroupedTrials.map((trial) => (
                            <Card 
                              key={trial.nctId}
                              className={`hover:shadow-md transition-shadow cursor-pointer ${
                                selectedItems.has(`trial-${trial.nctId}`) ? 'ring-2 ring-blue-500' : ''
                              }`}
                              onClick={() => handleItemSelect(trial.nctId, 'trial')}
                            >
                              <CardContent className="p-3">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-sm line-clamp-2 mb-1">
                                      {trial.briefTitle}
                                    </h5>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      <Badge variant="outline" className="text-xs">
                                        {trial.overallStatus}
                                      </Badge>
                                      {trial.phase && trial.phase.length > 0 && (
                                        <Badge variant="secondary" className="text-xs">
                                          {trial.phase.join(', ')}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-600 line-clamp-2">
                                      {trial.conditions?.join(', ')}
                                    </p>
                                  </div>
                                  <div className="ml-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      asChild
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <a 
                                        href={`https://clinicaltrials.gov/ct2/show/${trial.nctId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ungrouped Research Papers */}
                    {groupedResults.ungroupedPapers.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Research Papers ({groupedResults.ungroupedPapers.length})
                        </h4>
                        <div className="space-y-2">
                          {groupedResults.ungroupedPapers.map((paper) => (
                            <Card 
                              key={paper.pmid}
                              className={`hover:shadow-md transition-shadow cursor-pointer ${
                                selectedItems.has(`paper-${paper.pmid}`) ? 'ring-2 ring-blue-500' : ''
                              }`}
                              onClick={() => handleItemSelect(paper.pmid, 'paper')}
                            >
                              <CardContent className="p-3">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-sm line-clamp-2 mb-1">
                                      {paper.title}
                                    </h5>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Users className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground">
                                        {paper.authors.slice(0, 2).join(', ')}
                                        {paper.authors.length > 2 && ' et al.'}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      <Badge variant="outline" className="text-xs">
                                        {paper.journal}
                                      </Badge>
                                      <Badge variant="secondary" className="text-xs">
                                        {paper.publicationDate}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-gray-600 line-clamp-2">
                                      {paper.abstract}
                                    </p>
                                  </div>
                                  <div className="ml-2 flex flex-col gap-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      asChild
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <a 
                                        href={paper.fullTextLinks.pubmed}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
