import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, Building2, FlaskConical, Calendar, AlertCircle, Sparkles, Loader2, Info, Users } from 'lucide-react';
import { DrugDetailModal } from '@/components/DrugDetailModal';
import type { PipelineDrugCandidate, PipelineStage } from '@/types/pipeline';
import type { ClinicalTrial } from '@/types/trials';
import type { DrugGroup } from '@/services/drugGroupingService';
import type { PubMedArticle } from '@/types/papers';
import { PipelineService } from '@/services/pipelineService';
import { PipelineLLMService } from '@/services/pipelineLLMService';

interface AssetDevelopmentPipelineProps {
  candidates?: PipelineDrugCandidate[];
  trials?: ClinicalTrial[];
  drugGroups?: DrugGroup[];
  query?: string;
  onAddPaperToContext?: (paper: PubMedArticle) => void;
  isPaperInContext?: (pmid: string) => boolean;
  pipelineCandidates?: any[];
  setPipelineCandidates?: React.Dispatch<React.SetStateAction<any[]>>;
}

export function AssetDevelopmentPipeline({ 
  candidates: propCandidates, 
  trials, 
  drugGroups,
  query = '',
  onAddPaperToContext,
  isPaperInContext,
  pipelineCandidates: externalCandidates,
  setPipelineCandidates: setExternalCandidates
}: AssetDevelopmentPipelineProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<PipelineStage | 'All'>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [processedCandidates, setProcessedCandidates] = useState<PipelineDrugCandidate[]>(externalCandidates || []);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [usedLLM, setUsedLLM] = useState((externalCandidates && externalCandidates.length > 0) || false);
  const [selectedDrug, setSelectedDrug] = useState<DrugGroup | null>(null);
  const [showDrugModal, setShowDrugModal] = useState(false);
  const [drugLimit, setDrugLimit] = useState<number>(10);

  // Sync external candidates to local state when they change
  React.useEffect(() => {
    if (externalCandidates && externalCandidates.length > 0) {
      console.log('[Pipeline] Syncing external candidates to local state:', externalCandidates.length);
      setProcessedCandidates(externalCandidates);
      setUsedLLM(true);
    }
  }, [externalCandidates]);

  // Handle LLM extraction
  const handleLLMExtraction = async () => {
    if (!drugGroups || drugGroups.length === 0) {
      setExtractionError('No drug data available. Please perform a search first.');
      return;
    }

    // Validate limit
    if (drugLimit < 1 || drugLimit > 50) {
      setExtractionError('Please enter a number between 1 and 50.');
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);

    try {
      const candidates = await PipelineLLMService.extractPipelineData(drugGroups, drugLimit);
      console.log('[Pipeline] Extracted candidates:', candidates);
      console.log('[Pipeline] Candidates length:', candidates.length);
      console.log('[Pipeline] Sample candidate:', candidates[0]);
      setProcessedCandidates(candidates);
      // Also update external state if provided (lifts state to Dashboard)
      if (setExternalCandidates) {
        setExternalCandidates(candidates);
        console.log('[Pipeline] Updated external state (Dashboard level)');
      }
      setUsedLLM(true);
      console.log('[Pipeline] State updated - processedCandidates should now be:', candidates.length);
    } catch (error) {
      console.error('LLM extraction failed:', error);
      setExtractionError(error instanceof Error ? error.message : 'Failed to extract pipeline data');
    } finally {
      setIsExtracting(false);
    }
  };

  // Get processing stats
  const processingStats = drugGroups ? PipelineLLMService.getProcessingStats(drugGroups, drugLimit) : null;

  const candidates = processedCandidates;

  // Format enrollment number with commas
  const formatEnrollment = (enrollment?: number) => {
    if (!enrollment) return 'N/A';
    return enrollment.toLocaleString();
  };

  // Handle drug click - find matching drug group and open modal
  const handleDrugClick = (candidate: PipelineDrugCandidate) => {
    if (!drugGroups || drugGroups.length === 0) return;

    // Direct ID match - pipeline candidates are derived from drugGroups
    const matchingDrug = drugGroups.find(group => 
      group.normalizedName === candidate.sourceGroupId
    );

    if (matchingDrug) {
      setSelectedDrug(matchingDrug);
      setShowDrugModal(true);
    } else {
      console.error('Drug group not found for:', candidate.scientificName, 'ID:', candidate.sourceGroupId);
    }
  };

  // Filter candidates based on search and filters
  const filteredCandidates = useMemo(() => {
    let filtered = candidates;

    // Apply stage filter
    if (selectedStage !== 'All') {
      filtered = filtered.filter(c => c.stage === selectedStage);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.scientificName.toLowerCase().includes(query) ||
        c.commercialName?.toLowerCase().includes(query) ||
        c.sponsorCompany.toLowerCase().includes(query) ||
        c.indications?.some(ind => ind.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [candidates, selectedStage, searchQuery]);

  // Get stage badge color
  const getStageBadgeVariant = (stage: PipelineStage) => {
    switch (stage) {
      case 'Marketed':
        return 'default'; // green
      case 'Phase III':
        return 'secondary'; // blue
      case 'Phase II':
        return 'outline'; // gray
      case 'Phase I':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStageBadgeColor = (stage: PipelineStage) => {
    switch (stage) {
      case 'Marketed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Phase III':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Phase II':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Phase I':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Pre-Clinical':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const stages: Array<PipelineStage | 'All'> = ['All', 'Marketed', 'Phase III', 'Phase II', 'Phase I', 'Pre-Clinical'];

  // Check if we have data available
  const hasDrugData = drugGroups && drugGroups.length > 0;
  const hasExtractedData = processedCandidates.length > 0;

  // Debug logging
  console.log('[Pipeline Render]', {
    processedCandidatesLength: processedCandidates.length,
    candidatesLength: candidates.length,
    filteredCandidatesLength: filteredCandidates.length,
    hasExtractedData,
    usedLLM,
    isExtracting
  });

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Info Banner - No Data */}
          {!hasDrugData && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-900">No Data Available</h3>
                  <p className="text-sm text-blue-800 mt-1">
                    To populate the asset development pipeline, perform a search in the Research tab first. 
                    The pipeline will extract drug candidates from your search results.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">Asset Development Pipeline</h1>
              <p className="text-gray-600 mt-1">
                {hasExtractedData 
                  ? `Showing ${candidates.length} AI-extracted drug candidates (ordered by papers + trials)`
                  : 'Extract comprehensive drug pipeline data from your search results'
                }
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Drug Limit Input */}
              {hasDrugData && !usedLLM && (
                <div className="flex items-center gap-2">
                  <label htmlFor="drugLimit" className="text-sm font-medium text-gray-700">
                    # of drugs:
                  </label>
                  <Input
                    id="drugLimit"
                    type="number"
                    min="1"
                    max="50"
                    value={drugLimit}
                    onChange={(e) => setDrugLimit(parseInt(e.target.value) || 10)}
                    className="w-20 h-9"
                  />
                </div>
              )}
              {/* AI Extraction Button */}
              {hasDrugData && !usedLLM && (
                <Button
                  onClick={handleLLMExtraction}
                  disabled={isExtracting}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      AI Extract
                    </>
                  )}
                </Button>
              )}
              {hasExtractedData && (
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <Filter className="h-4 w-4" />
                  <span className="text-sm font-medium">Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* Processing Stats Info */}
          {processingStats && !usedLLM && !isExtracting && (
            <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-purple-900">AI Extraction Available</h3>
                  <p className="text-sm text-purple-800 mt-1">
                    Click "AI Extract" to use Claude AI to extract comprehensive drug information from your search results. 
                    Drugs are ordered by total papers + trials count. Set the number of drugs to process (1-50) and click extract.
                  </p>
                  <p className="text-xs text-purple-700 mt-2">
                    Will process: {processingStats.willProcess} drugs{processingStats.willSkip > 0 ? ` (${processingStats.willSkip} will be skipped)` : ''}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Extraction Error */}
          {extractionError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-900">Extraction Failed</h3>
                  <p className="text-sm text-red-800 mt-1">{extractionError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Extraction Progress */}
          {isExtracting && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-900">Extracting Pipeline Data...</h3>
                  <p className="text-sm text-blue-800 mt-1">
                    Processing top {drugLimit} drugs with AI. This may take {Math.ceil(drugLimit * 2 / 60)} minute{Math.ceil(drugLimit * 2 / 60) > 1 ? 's' : ''}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* LLM Success Badge */}
          {usedLLM && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">
                  AI-extracted comprehensive drug data with high accuracy
                </span>
              </div>
            </div>
          )}

          {/* Search and Filters */}
          {hasExtractedData && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by drug name, company, or indication..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>

              {/* Stage Filters */}
              {showFilters && (
                <div className="flex flex-wrap gap-2">
                  {stages.map((stage) => (
                    <button
                      key={stage}
                      onClick={() => setSelectedStage(stage)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        selectedStage === stage
                          ? 'bg-gray-800 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {stage}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Drug Candidate
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Sponsor Company
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Stage
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Technologies
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Mechanism of Action
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Indications
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Total Enrollment
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Last Trial Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        <FlaskConical className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                        <p className="text-lg font-medium">
                          {!hasExtractedData 
                            ? 'No pipeline data extracted yet' 
                            : 'No candidates found'
                          }
                        </p>
                        <p className="text-sm mt-1">
                          {!hasExtractedData
                            ? 'Perform a search and click "AI Extract" to populate the pipeline'
                            : 'Try adjusting your search or filters'
                          }
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((candidate, index) => (
                      <tr
                        key={candidate.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        {/* Drug Candidate */}
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-sm font-bold text-blue-600">
                                {index + 1}
                              </span>
                            </div>
                            <div>
                              {candidate.commercialName ? (
                                <>
                                  <button
                                    onClick={() => handleDrugClick(candidate)}
                                    className="font-semibold text-gray-900 hover:text-blue-600 transition-colors text-left"
                                  >
                                    {candidate.commercialName}
                                  </button>
                                  <div className="text-sm text-gray-600">
                                    ({candidate.scientificName})
                                  </div>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleDrugClick(candidate)}
                                  className="font-semibold text-gray-900 hover:text-blue-600 transition-colors text-left"
                                >
                                  {candidate.scientificName}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Sponsor Company */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-900 font-medium">
                              {candidate.sponsorCompany}
                            </span>
                          </div>
                        </td>

                        {/* Stage */}
                        <td className="px-6 py-4">
                          <Badge
                            className={`${getStageBadgeColor(candidate.stage)} border font-semibold`}
                          >
                            {candidate.stage}
                          </Badge>
                        </td>

                        {/* Technologies */}
                        <td className="px-6 py-4">
                          <span className="text-gray-700">
                            {candidate.technologies || 'N/A'}
                          </span>
                        </td>

                        {/* Mechanism of Action */}
                        <td className="px-6 py-4">
                          <span className="text-gray-700">
                            {candidate.mechanismOfAction || 'N/A'}
                          </span>
                        </td>

                        {/* Indications */}
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {candidate.indications && candidate.indications.length > 0 ? (
                              candidate.indications.map((indication, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {indication}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-gray-500 text-sm">N/A</span>
                            )}
                          </div>
                        </td>

                        {/* Total Enrollment */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700 text-sm font-medium">
                              {formatEnrollment(candidate.totalEnrollment)}
                            </span>
                          </div>
                        </td>

                        {/* Last Trial Date */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700 text-sm">
                              {formatDate(candidate.lastTrialStartDate)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Summary Stats */}
          {filteredCandidates.length > 0 && (
            <div className="mt-6 grid grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="text-2xl font-bold text-gray-900">
                  {filteredCandidates.length}
                </div>
                <div className="text-sm text-gray-600 mt-1">Total Candidates</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {filteredCandidates.filter(c => c.stage === 'Marketed').length}
                </div>
                <div className="text-sm text-gray-600 mt-1">Marketed</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {filteredCandidates.filter(c => c.stage === 'Phase III').length}
                </div>
                <div className="text-sm text-gray-600 mt-1">Phase III</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-yellow-600">
                  {filteredCandidates.filter(c => c.stage === 'Phase II').length}
                </div>
                <div className="text-sm text-gray-600 mt-1">Phase II</div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Drug Detail Modal */}
      {showDrugModal && selectedDrug && (
        <DrugDetailModal
          drugGroup={selectedDrug}
          query={query}
          onClose={() => {
            setShowDrugModal(false);
            setSelectedDrug(null);
          }}
          onAddPaperToContext={onAddPaperToContext}
          isPaperInContext={isPaperInContext}
        />
      )}
    </div>
  );
}

