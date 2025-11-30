 
import React from 'react'
import { PDFExtraction } from '@/components/PDFExtraction'

interface DataExtractionViewProps {
  isVisible?: boolean;
  currentProjectId: number | null;
  onAddToChat?: (extraction: {
    jobId: string
    fileName: string
    markdownContent: string
    hasTables: boolean
    tablesData?: Array<{
      index: number;
      headers: string[];
      rows: string[][];
      rawMarkdown: string;
    }>;
    graphifyResults?: Array<{
      imageName: string;
      isGraph: boolean;
      graphType?: string;
      reason?: string;
      pythonCode?: string;
      data?: Record<string, unknown>;
      assumptions?: string;
      error?: string;
      renderedImage?: string;
      renderError?: string;
      renderTimeMs?: number;
    }>;
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

