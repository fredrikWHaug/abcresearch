import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, ChevronDown, ChevronUp, ExternalLink, Users, Star, Loader2 } from 'lucide-react';
import type { ClinicalTrial } from '@/services/clinicalTrialsAPI';
import type { PubMedArticle } from '@/services/pubmedAPI';
import { pubmedAPI } from '@/services/pubmedAPI';

interface SearchResultsModalProps {
  open: boolean;
  onClose: () => void;
  drugs: string[];
  trials: ClinicalTrial[];
  query: string;
}

export const SearchResultsModal: React.FC<SearchResultsModalProps> = ({
  open,
  onClose,
  drugs,
  trials,
  query
}) => {
  const [selectedDrug, setSelectedDrug] = useState<string | null>(null);
  const [drugPapers, setDrugPapers] = useState<Record<string, PubMedArticle[]>>({});
  const [loadingPapers, setLoadingPapers] = useState<Record<string, boolean>>({});
  const [expandedDrug, setExpandedDrug] = useState<string | null>(null);

  // Load papers for a drug when it's selected
  const handleDrugClick = async (drug: string) => {
    if (selectedDrug === drug) {
      // Toggle collapse
      setSelectedDrug(null);
      setExpandedDrug(null);
      return;
    }

    setSelectedDrug(drug);
    setExpandedDrug(drug);

    // If we already have papers for this drug, don't fetch again
    if (drugPapers[drug]) {
      return;
    }

    // Fetch papers for this drug
    setLoadingPapers(prev => ({ ...prev, [drug]: true }));
    
    try {
      const papers = await pubmedAPI.searchPapers({
        query: `${drug} AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])`,
        maxResults: 20
      });
      
      setDrugPapers(prev => ({ ...prev, [drug]: papers }));
    } catch (error) {
      console.error(`Error fetching papers for ${drug}:`, error);
      setDrugPapers(prev => ({ ...prev, [drug]: [] }));
    } finally {
      setLoadingPapers(prev => ({ ...prev, [drug]: false }));
    }
  };

  // Get trials related to a specific drug
  const getTrialsForDrug = (drug: string): ClinicalTrial[] => {
    return trials.filter(trial => 
      trial.title.toLowerCase().includes(drug.toLowerCase()) ||
      trial.briefSummary?.toLowerCase().includes(drug.toLowerCase()) ||
      trial.interventions?.some(int => 
        int.name?.toLowerCase().includes(drug.toLowerCase())
      )
    );
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-[95vw] w-[95vw] h-[95vh] p-0 overflow-hidden"
        onClose={onClose}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Search Results</h2>
            <p className="text-sm text-gray-600 mt-1">
              Found {drugs.length} drugs and {trials.length} clinical trials
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content - Split View */}
        <div className="flex h-[calc(100%-5rem)] overflow-hidden">
          {/* Left Side - Drugs List */}
          <div className="w-1/2 border-r overflow-y-auto p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Drugs ({drugs.length})</h3>
              <p className="text-sm text-gray-600">Click on a drug to see related research papers</p>
            </div>
            
            <div className="space-y-2">
              {drugs.map((drug, index) => {
                const drugTrials = getTrialsForDrug(drug);
                const isExpanded = expandedDrug === drug;
                
                return (
                  <div key={index} className="space-y-2">
                    <Card
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedDrug === drug ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => handleDrugClick(drug)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{drug}</h4>
                            <p className="text-sm text-gray-600 mt-1">
                              {drugTrials.length} clinical trial{drugTrials.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {loadingPapers[drug] && (
                              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            )}
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Papers for this drug */}
                    {isExpanded && drugPapers[drug] && (
                      <div className="ml-4 space-y-2 animate-in slide-in-from-top">
                        <div className="text-sm font-medium text-gray-700 mb-2">
                          Research Papers ({drugPapers[drug].length})
                        </div>
                        {drugPapers[drug].length === 0 ? (
                          <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg">
                            No papers found for this drug
                          </div>
                        ) : (
                          drugPapers[drug].map((paper) => (
                            <Card key={paper.pmid} className="hover:shadow-md transition-shadow">
                              <CardHeader className="p-4">
                                <div className="flex justify-between items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <CardTitle className="text-sm line-clamp-2">
                                      {paper.title}
                                    </CardTitle>
                                    <div className="flex items-center gap-2 mt-2">
                                      <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      <span className="text-xs text-muted-foreground truncate">
                                        {paper.authors.slice(0, 2).join(', ')}
                                        {paper.authors.length > 2 && ' et al.'}
                                      </span>
                                    </div>
                                  </div>
                                  <Badge className={getRelevanceColor(paper.relevanceScore)}>
                                    <Star className="h-3 w-3 mr-1" />
                                    {paper.relevanceScore}%
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent className="p-4 pt-0">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-1">
                                    <Badge variant="outline" className="text-xs">
                                      {paper.journal}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                      {paper.publicationDate}
                                    </Badge>
                                  </div>
                                  
                                  <p className="text-xs line-clamp-2 text-muted-foreground">
                                    {paper.abstract}
                                  </p>
                                  
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      asChild
                                    >
                                      <a 
                                        href={paper.fullTextLinks.pubmed} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        PubMed
                                      </a>
                                    </Button>
                                    
                                    {paper.fullTextLinks.doi && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs"
                                        asChild
                                      >
                                        <a 
                                          href={paper.fullTextLinks.doi} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <ExternalLink className="h-3 w-3 mr-1" />
                                          DOI
                                        </a>
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side - Clinical Trials */}
          <div className="w-1/2 overflow-y-auto p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Clinical Trials ({trials.length})
              </h3>
              <p className="text-sm text-gray-600">All trials related to your search</p>
            </div>
            
            <div className="space-y-4">
              {trials.map((trial) => (
                <Card key={trial.nctId} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-base line-clamp-2">{trial.title}</CardTitle>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge variant="outline">{trial.nctId}</Badge>
                          {trial.overallStatus && (
                            <Badge 
                              className={
                                trial.overallStatus === 'RECRUITING' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }
                            >
                              {trial.overallStatus}
                            </Badge>
                          )}
                          {trial.phase && trial.phase.length > 0 && (
                            <Badge variant="secondary">{trial.phase.join(', ')}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {trial.briefSummary && (
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {trial.briefSummary}
                        </p>
                      )}
                      
                      {trial.sponsors?.lead && (
                        <div className="text-sm">
                          <span className="font-medium">Sponsor: </span>
                          <span className="text-muted-foreground">{trial.sponsors.lead}</span>
                        </div>
                      )}
                      
                      {trial.interventions && trial.interventions.length > 0 && (
                        <div className="text-sm">
                          <span className="font-medium">Interventions: </span>
                          <span className="text-muted-foreground">
                            {trial.interventions.map(i => i.name).join(', ')}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a 
                            href={`https://clinicaltrials.gov/study/${trial.nctId}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View on ClinicalTrials.gov
                          </a>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

