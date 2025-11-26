 
import React from 'react'
import { PDFExtraction } from '@/components/PDFExtraction'

interface DataExtractionViewProps {
  isVisible?: boolean;
}

export function DataExtractionView({ isVisible }: DataExtractionViewProps) {
  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <PDFExtraction isVisible={isVisible} />
    </div>
  )
}

