 
import React from 'react'
import { PDFExtraction } from '@/components/PDFExtraction'

interface DataExtractionViewProps {
  isVisible?: boolean;
  currentProjectId: number | null;
}

export function DataExtractionView({ isVisible, currentProjectId }: DataExtractionViewProps) {
  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <PDFExtraction
        isVisible={isVisible}
        currentProjectId={currentProjectId}
      />
    </div>
  )
}

