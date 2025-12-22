/* eslint-disable */
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, X, Loader2, Image } from 'lucide-react';
import { PDFExtractionJobService } from '@/services/pdfExtractionJobService';
import type { PDFExtractionJob } from '@/types/pdf-extraction-job';

interface PDFUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId: number | null;
  onExtractionComplete: () => void;
}

export function PDFUploadModal({
  isOpen,
  onClose,
  currentProjectId,
  onExtractionComplete
}: PDFUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [enableGraphify, setEnableGraphify] = useState(true);
  const [maxImages, setMaxImages] = useState(10);
  const [currentJob, setCurrentJob] = useState<PDFExtractionJob | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStage, setJobStage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<number | null>(null);

  const hasActiveProject = currentProjectId !== null;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isProcessing) return;

    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError(null);
    } else if (file) {
      setError('Please drop a PDF file');
    }
  };

  const handleExtractContent = async () => {
    if (!selectedFile || !currentProjectId) return;

    setIsProcessing(true);
    setError(null);
    setJobProgress(0);
    setJobStage('Starting...');

    try {
      const response = await PDFExtractionJobService.submitJob(
        selectedFile,
        {
          projectId: currentProjectId,
          enableGraphify,
          maxGraphifyImages: maxImages
        }
      );

      if (!response.success || !response.job) {
        throw new Error(response.error || 'Failed to submit extraction job');
      }

      const job = response.job;
      setCurrentJob(job);
      setJobProgress(job.progress);
      setJobStage(job.current_stage || 'Processing...');

      // Start polling for job status
      const pollJob = async () => {
        const statusResponse = await PDFExtractionJobService.getJob(job.id);

        if (!statusResponse.success || !statusResponse.job) {
          return;
        }

        const updatedJob = statusResponse.job;
        setCurrentJob(updatedJob);
        setJobProgress(updatedJob.progress);
        setJobStage(updatedJob.current_stage || 'Processing...');

        if (updatedJob.status === 'completed' || updatedJob.status === 'partial') {
          setIsProcessing(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          // Wait a moment, then close modal and refresh
          setTimeout(() => {
            onExtractionComplete();
            handleClose();
          }, 1500);
        } else if (updatedJob.status === 'failed') {
          setIsProcessing(false);
          setError(updatedJob.error_message || 'Extraction failed');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      };

      // Poll immediately
      await pollJob();

      // Set up polling interval (2 seconds)
      pollingIntervalRef.current = window.setInterval(pollJob, 2000);

    } catch (error) {
      console.error('Error extracting content:', error);
      setError(error instanceof Error ? error.message : 'Failed to extract PDF content');
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return; // Don't close while processing

    // Cleanup
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    setSelectedFile(null);
    setError(null);
    setCurrentJob(null);
    setJobProgress(0);
    setJobStage('');
    onClose();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <Card className="shadow-2xl border-white/20 bg-white/95 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-6 w-6" />
                  PDF Data Extraction
                </CardTitle>
                <CardDescription>
                  Upload a PDF to extract tables, text, and graphs
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                disabled={isProcessing}
                className="text-gray-500 hover:text-gray-900"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {!hasActiveProject && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Select or create a project before uploading a PDF
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                {error}
              </div>
            )}

            {/* File Upload Area */}
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="pdf-upload-modal"
                disabled={isProcessing}
              />
              <label htmlFor="pdf-upload-modal">
                <Button
                  variant="outline"
                  className={`w-full h-32 border-2 border-dashed cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-primary bg-primary/10 border-solid'
                      : 'hover:border-primary hover:bg-accent'
                  }`}
                  asChild
                  disabled={isProcessing}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-medium">
                      {isDragging
                        ? 'Drop PDF file here'
                        : selectedFile
                          ? 'Change PDF file'
                          : 'Click or drag to upload PDF file'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Only PDF files are accepted
                    </span>
                  </div>
                </Button>
              </label>
            </div>

            {/* Selected File Display */}
            {selectedFile && (
              <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                {!isProcessing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedFile(null)}
                    className="text-gray-500 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            {/* Processing Options */}
            {selectedFile && !isProcessing && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                <p className="text-sm font-medium text-gray-700">Extraction Options:</p>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableGraphify}
                    onChange={(e) => setEnableGraphify(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="flex items-center gap-2">
                    <Image className="h-4 w-4 text-gray-500" />
                    Enable graph detection with GPT Vision
                  </span>
                </label>

                {enableGraphify && (
                  <div className="ml-6 space-y-2 p-3 bg-white rounded border border-gray-200">
                    <label className="text-xs text-gray-600 block">
                      Max images to analyze: <span className="font-medium text-gray-900">{maxImages}</span>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={maxImages}
                        onChange={(e) => setMaxImages(parseInt(e.target.value))}
                        className="w-full mt-1"
                      />
                    </label>
                    <p className="text-xs text-gray-500">
                      Higher values increase processing time and cost
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Extract Button */}
            {!isProcessing && (
              <Button
                onClick={handleExtractContent}
                disabled={!selectedFile || !hasActiveProject}
                className="w-full"
              >
                <Upload className="h-4 w-4" />
                Extract Content
              </Button>
            )}

            {/* Processing State */}
            {isProcessing && (
              <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-900">Processing PDF...</p>
                  <p className="text-xs text-gray-600 mt-1">{jobStage || 'Initializing...'}</p>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Progress</span>
                    <span>{jobProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-300 ease-out"
                      style={{ width: `${jobProgress}%` }}
                    />
                  </div>
                </div>

                {/* Stage Info */}
                <div className="text-xs text-gray-500 text-center">
                  {jobProgress < 20 && '⏳ Uploading to processing server...'}
                  {jobProgress >= 20 && jobProgress < 80 && '📄 Extracting content from PDF...'}
                  {jobProgress >= 80 && jobProgress < 95 && '🔍 Analyzing images and graphs...'}
                  {jobProgress >= 95 && '✨ Finalizing results...'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
