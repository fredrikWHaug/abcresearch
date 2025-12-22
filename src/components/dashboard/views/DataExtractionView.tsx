import React, { useState, useEffect } from 'react';
import { ExtractionHistoryGrid } from '@/components/ExtractionHistoryGrid';
import { PDFUploadModal } from '@/components/PDFUploadModal';
import { PDFExtractionJobService } from '@/services/pdfExtractionJobService';
import type { TableData, GraphifyResult } from '@/types/extraction';

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
  }) => void;
  onRemoveFromChat?: (jobId: string) => void;
  isExtractionInContext?: (jobId: string) => boolean;
}

export function DataExtractionView({
  isVisible: _isVisible,
  currentProjectId,
  onAddToChat,
  onRemoveFromChat,
  isExtractionInContext
}: DataExtractionViewProps) {
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [hasExtractions, setHasExtractions] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Check for existing extractions on mount and project change
  useEffect(() => {
    const checkExtractions = async () => {
      try {
        setIsLoadingJobs(true);
        const response = await PDFExtractionJobService.listJobs({
          limit: 50,
          projectId: typeof currentProjectId === 'number' ? currentProjectId : undefined
        });

        if (response.success) {
          setHasExtractions(response.jobs.length > 0);
        }
      } catch (error) {
        console.error('Error checking extractions:', error);
      } finally {
        setIsLoadingJobs(false);
      }
    };

    checkExtractions();
  }, [currentProjectId, refreshTrigger]);

  const handleOpenUploadModal = () => {
    setShowUploadModal(true);
  };

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
  };

  const handleExtractionComplete = () => {
    // Trigger refresh of extraction grid
    setRefreshTrigger(prev => prev + 1);
    setHasExtractions(true);
  };

  // Show loading spinner while checking for extractions
  if (isLoadingJobs) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your extractions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full overflow-y-auto bg-gray-50">
        <ExtractionHistoryGrid
          onNewExtraction={handleOpenUploadModal}
          currentProjectId={currentProjectId}
          refreshTrigger={refreshTrigger}
          onAddToChat={onAddToChat}
          onRemoveFromChat={onRemoveFromChat}
          isInContext={isExtractionInContext}
        />
      </div>

      {/* PDF Upload Modal - Overlays on top */}
      <PDFUploadModal
        isOpen={showUploadModal}
        onClose={handleCloseUploadModal}
        currentProjectId={currentProjectId}
        onExtractionComplete={handleExtractionComplete}
      />
    </>
  );
}
