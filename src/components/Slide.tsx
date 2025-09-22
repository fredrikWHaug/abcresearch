import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, X } from 'lucide-react';

interface SlideData {
  title: string;
  insights: string[];
  tableData: Array<{
    nctId: string;
    title: string;
    phase: string;
    status: string;
    sponsor: string;
    enrollment: number;
  }>;
  summary: string;
}

interface SlideProps {
  slideData: SlideData;
  onClose: () => void;
  query: string;
}

export function Slide({ slideData, onClose, query }: SlideProps) {
  const getPhaseColor = (phase: string) => {
    if (phase.includes('3')) return 'bg-green-100 text-green-700';
    if (phase.includes('2')) return 'bg-blue-100 text-blue-700';
    if (phase.includes('1')) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'RECRUITING':
        return 'bg-green-100 text-green-700';
      case 'COMPLETED':
        return 'bg-gray-100 text-gray-700';
      case 'ACTIVE_NOT_RECRUITING':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header with controls */}
        <div className="flex justify-between items-center p-4 border-b print:hidden">
          <h2 className="text-lg font-semibold">Generated Market Analysis Slide</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              <Download className="h-4 w-4" />
              Print/Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Slide Content */}
        <div className="p-8 bg-white" id="slide-content">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {slideData.title}
            </h1>
            <p className="text-gray-600">
              Analysis based on query: "{query}"
            </p>
            <div className="w-24 h-1 bg-blue-500 mx-auto mt-4"></div>
          </div>

          {/* Key Insights */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Key Insights</h2>
            <div className="grid gap-3">
              {slideData.insights.map((insight, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">
                    {index + 1}
                  </div>
                  <p className="text-gray-700 flex-1">{insight}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Data Table */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Clinical Trials Overview</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold">NCT ID</th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold">Study Title</th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold">Phase</th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold">Status</th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold">Sponsor</th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold">Enrollment</th>
                  </tr>
                </thead>
                <tbody>
                  {slideData.tableData.map((trial, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-3 py-2 text-sm font-mono">
                        {trial.nctId}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-sm">
                        {trial.title}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-sm">
                        <Badge className={getPhaseColor(trial.phase)}>
                          {trial.phase}
                        </Badge>
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-sm">
                        <Badge className={getStatusColor(trial.status)}>
                          {trial.status}
                        </Badge>
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-sm">
                        {trial.sponsor}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-sm text-right">
                        {trial.enrollment.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Market Summary */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Market Summary</h2>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-gray-700 leading-relaxed">{slideData.summary}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-sm text-gray-500 mt-8 pt-4 border-t">
            <p>Generated by ABCresearch • Data source: ClinicalTrials.gov • {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            .print\\:hidden {
              display: none !important;
            }
            
            body * {
              visibility: hidden;
            }
            
            #slide-content, #slide-content * {
              visibility: visible;
            }
            
            #slide-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
          }
        `
      }} />
    </div>
  );
}
