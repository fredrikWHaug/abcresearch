import React, { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Filter, Building2, FlaskConical, Calendar, AlertCircle } from 'lucide-react';
import type { PipelineDrugCandidate, PipelineStage } from '@/types/pipeline';
import type { ClinicalTrial } from '@/types/trials';
import { PipelineService } from '@/services/pipelineService';

interface AssetDevelopmentPipelineProps {
  candidates?: PipelineDrugCandidate[];
  trials?: ClinicalTrial[];
}

// Mock data for demonstration - will be replaced with real data from API/database
const MOCK_CANDIDATES: PipelineDrugCandidate[] = [
  {
    id: '1',
    commercialName: 'ADUHELM™',
    scientificName: 'Aducanumab',
    sponsorCompany: 'Biogen',
    stage: 'Marketed',
    technologies: 'Biologics',
    mechanismOfAction: 'Monotherapy',
    indications: ['Alzheimer\'s Disease'],
    lastTrialStartDate: '2015-08-01',
  },
  {
    id: '2',
    commercialName: 'Namzaric',
    scientificName: 'Memantine/Donepezil',
    sponsorCompany: 'Allergan',
    stage: 'Marketed',
    technologies: 'Small Molecule',
    mechanismOfAction: 'Combination Therapy',
    indications: ['Alzheimer\'s Disease'],
    lastTrialStartDate: '2012-03-15',
  },
  {
    id: '3',
    scientificName: 'ALZ-801',
    sponsorCompany: 'Alzheon',
    stage: 'Phase III',
    technologies: 'Small Molecule',
    mechanismOfAction: 'Oral',
    indications: ['Alzheimer\'s Disease'],
    lastTrialStartDate: '2019-06-20',
  },
  {
    id: '4',
    scientificName: 'Gantenerumab',
    sponsorCompany: 'Roche',
    stage: 'Phase III',
    technologies: 'Biologics',
    mechanismOfAction: 'Monotherapy',
    indications: ['Alzheimer\'s Disease'],
    lastTrialStartDate: '2018-11-12',
  },
  {
    id: '5',
    scientificName: 'Donanemab',
    sponsorCompany: 'Eli Lilly',
    stage: 'Phase III',
    technologies: 'Biologics',
    mechanismOfAction: 'Monotherapy',
    indications: ['Alzheimer\'s Disease'],
    lastTrialStartDate: '2020-07-08',
  },
  {
    id: '6',
    scientificName: 'Lecanemab',
    sponsorCompany: 'Eisai/Biogen',
    stage: 'Phase III',
    technologies: 'Biologics',
    mechanismOfAction: 'Monotherapy',
    indications: ['Alzheimer\'s Disease'],
    lastTrialStartDate: '2019-03-14',
  },
  {
    id: '7',
    scientificName: 'GV1001',
    sponsorCompany: 'GemVax',
    stage: 'Phase II',
    technologies: 'Biologics',
    mechanismOfAction: 'Immunotherapy',
    indications: ['Alzheimer\'s Disease'],
    lastTrialStartDate: '2020-09-01',
  },
];

export function AssetDevelopmentPipeline({ candidates: propCandidates, trials }: AssetDevelopmentPipelineProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<PipelineStage | 'All'>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [processedCandidates, setProcessedCandidates] = useState<PipelineDrugCandidate[]>([]);

  // Process trials into pipeline candidates when trials change
  useEffect(() => {
    if (propCandidates) {
      // Use provided candidates
      setProcessedCandidates(propCandidates);
    } else if (trials && trials.length > 0) {
      // Convert trials to pipeline candidates
      const converted = PipelineService.trialsToPipeline(trials);
      setProcessedCandidates(converted);
    } else {
      // Use mock data as fallback
      setProcessedCandidates(MOCK_CANDIDATES);
    }
  }, [propCandidates, trials]);

  const candidates = processedCandidates;

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

  // Check if we're using real data or mock data
  const isUsingRealData = trials && trials.length > 0;
  const isUsingMockData = !trials || trials.length === 0;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Info Banner for Mock Data */}
          {isUsingMockData && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-900">Demo Data</h3>
                  <p className="text-sm text-blue-800 mt-1">
                    You're viewing sample pipeline data. To see real drug candidates, perform a search in the Research tab first. 
                    The pipeline will automatically populate with drugs from your search results.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Asset Development Pipeline</h1>
              <p className="text-gray-600 mt-1">
                {isUsingRealData 
                  ? `Showing ${candidates.length} drug candidates from your search results`
                  : 'Comprehensive view of drug candidates across development stages'
                }
              </p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Filters</span>
            </button>
          </div>

          {/* Search and Filters */}
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
                      Last Trial Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        <FlaskConical className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                        <p className="text-lg font-medium">No candidates found</p>
                        <p className="text-sm mt-1">Try adjusting your search or filters</p>
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
                                  <div className="font-semibold text-gray-900">
                                    {candidate.commercialName}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    ({candidate.scientificName})
                                  </div>
                                </>
                              ) : (
                                <div className="font-semibold text-gray-900">
                                  {candidate.scientificName}
                                </div>
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
    </div>
  );
}

