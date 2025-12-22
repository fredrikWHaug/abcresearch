/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PDFExtractionJobService } from '@/services/pdfExtractionJobService';
import type { PDFExtractionJob } from '@/types/pdf-extraction-job';
import type { PDFExtractionResult, TableData, GraphifyResult } from '@/types/extraction';
import { Loader2, FileText, Calendar, ArrowRight, Plus, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatedGradientBackground } from '@/components/AnimatedGradientBackground';
import { PaperAnalysisView } from './PaperAnalysisView';

const MotionCard = motion(Card);

interface ExtractionHistoryGridProps {
  onNewExtraction: () => void;
  currentProjectId?: number | null;
  refreshTrigger?: number;
  onAddToChat?: (extraction: {
    jobId: string
    fileName: string
    markdownContent: string
    hasTables: boolean
    tablesData?: TableData[];
    graphifyResults?: GraphifyResult[];
  }) => void;
  onRemoveFromChat?: (jobId: string) => void;
  isInContext?: (jobId: string) => boolean;
}

export function ExtractionHistoryGrid({
  onNewExtraction,
  currentProjectId,
  refreshTrigger,
  onAddToChat: _onAddToChat,
  onRemoveFromChat: _onRemoveFromChat,
  isInContext: _isInContext
}: ExtractionHistoryGridProps) {
  const [jobs, setJobs] = useState<PDFExtractionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<PDFExtractionResult | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedJobIsPartial, setSelectedJobIsPartial] = useState(false);

  useEffect(() => {
    loadJobs();
  }, [currentProjectId, refreshTrigger]);

  // Poll for in-progress jobs
  useEffect(() => {
    const interval = setInterval(() => {
      const inProgressJobs = jobs.filter(j =>
        j.status === 'processing' || j.status === 'pending' || j.status === 'partial'
      );
      if (inProgressJobs.length > 0) {
        loadJobs();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [jobs]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await PDFExtractionJobService.listJobs({
        limit: 50,
        projectId: typeof currentProjectId === 'number' ? currentProjectId : undefined
      });

      if (response.success) {
        setJobs(response.jobs);
      }
    } catch (err) {
      console.error('Error loading extraction jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load extraction jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleViewResult = async (job: PDFExtractionJob) => {
    if (job.status !== 'completed' && job.status !== 'partial') return;

    const response = await PDFExtractionJobService.getJob(job.id);

    if (response.success && response.result) {
      const result = response.result;
      const blobs = PDFExtractionJobService.convertResultToBlobs(result);

      const extractionResult: PDFExtractionResult = {
        success: true,
        jobId: job.id,
        markdownContent: result.markdown_content || undefined,
        markdownBlob: blobs.markdownBlob,
        responseJson: result.response_json || undefined,
        responseJsonBlob: blobs.responseJsonBlob,
        originalImagesBlob: blobs.originalImagesBlob,
        graphifyResults: result.graphify_results ? {
          summary: result.graphify_results as any[],
          graphifyJsonBlob: blobs.graphifyJsonBlob
        } : undefined,
        stats: {
          imagesFound: result.images_found,
          graphsDetected: result.graphs_detected,
          processingTimeMs: result.processing_time_ms || 0,
          tablesFound: result.tables_found
        }
      };

      setSelectedResult(extractionResult);
      setSelectedFileName(job.file_name);
      setSelectedJobIsPartial(job.status === 'partial');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'partial':
        return <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'processing':
      case 'pending':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  // If viewing a result, show the analysis view
  if (selectedResult && selectedFileName) {
    return (
      <PaperAnalysisView
        result={selectedResult}
        fileName={selectedFileName}
        onBack={() => {
          setSelectedResult(null);
          setSelectedFileName('');
          setSelectedJobIsPartial(false);
        }}
        isPartialResult={selectedJobIsPartial}
      />
    );
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col relative">
        <AnimatedGradientBackground />
        <div className="flex-1 flex items-center justify-center px-6 relative z-10">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Almost there...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col relative">
        <AnimatedGradientBackground />
        <div className="flex-1 flex items-center justify-center px-6 relative z-10">
          <div className="text-center bg-white/70 backdrop-blur-xl rounded-3xl p-12 shadow-2xl border border-white/50">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={loadJobs} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Animated Gradient Background */}
      <AnimatedGradientBackground />

      {/* Content */}
      <div className="px-6 py-10 max-w-7xl mx-auto w-full relative z-10">
        {/* Header with frosted glass effect */}
        <div className="mb-10 bg-white/60 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-white/50">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Your Extractions
          </h1>
          <p className="text-gray-600 text-lg">
            {jobs.length} extraction{jobs.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Extractions Grid */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          data-testid="extractions-grid"
        >
          {/* New Extraction Card */}
          <MotionCard
            className="border-2 border-dashed border-white/40 hover:border-blue-400/60 hover:shadow-2xl bg-white/40 backdrop-blur-xl cursor-pointer group relative overflow-hidden"
            onClick={onNewExtraction}
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            data-testid="new-extraction-card"
          >
            <CardHeader className="flex flex-col items-center justify-center h-48 text-center relative z-10">
              <div className="rounded-full p-4 mb-4 group-hover:scale-110 transition-all duration-300 shadow-lg bg-blue-100/60 backdrop-blur-sm group-hover:bg-blue-200/70">
                <Plus className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-lg font-semibold mb-1 text-gray-900">
                New Extraction
              </CardTitle>
              <p className="text-sm text-gray-600">
                Upload PDF to extract data
              </p>
            </CardHeader>
            {/* Subtle gradient on hover */}
            <div className="absolute inset-0 bg-linear-to-br from-blue-100/0 to-blue-100/0 group-hover:from-blue-100/40 group-hover:to-purple-100/30 transition-all duration-300 pointer-events-none" />
          </MotionCard>

          {/* Existing Extraction Cards */}
          {jobs.map((job) => (
            <MotionCard
              key={job.id}
              className="group border border-white/50 hover:border-white/70 hover:shadow-2xl bg-white/50 backdrop-blur-xl cursor-pointer relative overflow-hidden"
              onClick={() => handleViewResult(job)}
              whileHover={{ scale: 1.05, y: -5 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              data-testid={`extraction-card-${job.id}`}
            >
              <CardHeader className="h-48 flex flex-col justify-between p-6 relative z-10">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="rounded-xl bg-linear-to-br from-blue-100/70 to-indigo-100/70 backdrop-blur-sm p-2 w-fit group-hover:from-blue-200/80 group-hover:to-indigo-200/80 transition-all duration-300 shadow-lg">
                      <FileText className="h-5 w-5 text-blue-700" />
                    </div>
                    {getStatusIcon(job.status)}
                  </div>
                  <CardTitle className="text-lg font-semibold text-gray-900 line-clamp-2 mb-2 group-hover:text-blue-700 transition-colors">
                    {job.file_name}
                  </CardTitle>
                  <p className="text-xs text-gray-600 capitalize">
                    {job.status}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {formatDate(job.created_at)}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-500 group-hover:text-blue-700 group-hover:translate-x-2 transition-all" />
                </div>

                {/* Progress bar for in-progress jobs */}
                {(job.status === 'processing' || job.status === 'pending' || job.status === 'partial') && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
                    <div
                      className={`h-full transition-all duration-300 ${
                        job.status === 'partial' ? 'bg-amber-600' : 'bg-blue-600'
                      }`}
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                )}
              </CardHeader>
              {/* Dynamic gradient overlay on hover */}
              <div className="absolute inset-0 bg-linear-to-br from-blue-100/0 to-purple-100/0 group-hover:from-blue-100/30 group-hover:to-purple-100/30 transition-all duration-500 pointer-events-none" />
            </MotionCard>
          ))}
        </div>
      </div>
    </div>
  );
}
