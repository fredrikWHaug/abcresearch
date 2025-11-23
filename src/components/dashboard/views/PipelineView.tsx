import React from 'react'
import { AssetDevelopmentPipeline } from '@/components/AssetDevelopmentPipeline'
import type { ClinicalTrial } from '@/types/trials'
import type { DrugGroup } from '@/services/drugGroupingService'
import type { PubMedArticle } from '@/types/papers'

interface PipelineViewProps {
  trials: ClinicalTrial[];
  drugGroups: DrugGroup[];
  query: string;
  onAddPaperToContext: (paper: PubMedArticle) => void;
  isPaperInContext: (pmid: string) => boolean;
  pipelineCandidates: any[];
  setPipelineCandidates: React.Dispatch<React.SetStateAction<any[]>>;
}

export function PipelineView({
  trials,
  drugGroups,
  query,
  onAddPaperToContext,
  isPaperInContext,
  pipelineCandidates,
  setPipelineCandidates
}: PipelineViewProps) {
  return (
    <div className="h-full overflow-hidden">
      <AssetDevelopmentPipeline
        trials={trials}
        drugGroups={drugGroups}
        query={query}
        onAddPaperToContext={onAddPaperToContext}
        isPaperInContext={isPaperInContext}
        pipelineCandidates={pipelineCandidates}
        setPipelineCandidates={setPipelineCandidates}
      />
    </div>
  )
}

