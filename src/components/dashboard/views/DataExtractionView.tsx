 
import React from 'react'
import { PDFExtraction } from '@/components/PDFExtraction'
import type { TableData, GraphifyResult } from '@/types/extraction'

interface DataExtractionViewProps {
  isVisible?: boolean;
  currentProjectId: number | null;
  onAddToChat?: (extraction: {
    jobId: string
    fileName: string
    markdownContent: string
    hasTables: boolean
    tablesData?: TableData[];
    graphifyResults?: GraphifyResult[];
  }) => void
  onRemoveFromChat?: (jobId: string) => void
  isExtractionInContext?: (jobId: string) => boolean
}

export function DataExtractionView({ isVisible, currentProjectId, onAddToChat, onRemoveFromChat, isExtractionInContext }: DataExtractionViewProps) {
  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <PDFExtraction
        isVisible={isVisible}
        currentProjectId={currentProjectId}
        onAddToChat={onAddToChat}
        onRemoveFromChat={onRemoveFromChat}
        isExtractionInContext={isExtractionInContext}
      />
    </div>
  )
}

