import React, { useState } from 'react';
import { Download, X, TrendingUp, TrendingDown, Minus, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarketMapService } from '@/services/marketMapService';
import type { ClinicalTrial } from '@/services/clinicalTrialsAPI';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ChartData {
  phaseChart: Array<{ name: string; value: number }>;
  statusChart: Array<{ name: string; value: number }>;
  sponsorChart: Array<{ name: string; value: number }>;
  yearChart: Array<{ year: string; value: number }>;
}

interface KeyMetric {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
}

interface SlideData {
  title: string;
  subtitle: string;
  keyMetrics: KeyMetric[];
  competitiveLandscape: string[];
  trendAnalysis: string;
  recommendation: string;
  chartData: ChartData;
}

interface SlideProps {
  slideData: SlideData;
  onClose: () => void;
  query: string;
  trials?: ClinicalTrial[];
  onSaveSuccess?: () => void;
}

// Generate static HTML for printing
const generatePrintHTML = (slideData: SlideData, query: string) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${slideData.title} - Market Analysis</title>
        <meta charset="utf-8">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          
          @media print {
            body { margin: 0; }
            .page-break { page-break-after: always; }
            .no-break { page-break-inside: avoid; }
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.5;
            color: #111827;
          }
          
          .chart-container {
            width: 100%;
            height: 300px;
            margin: 20px 0;
          }
          
          .metric-box {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
          }
          
          .chart-placeholder {
            background: #f3f4f6;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 40px;
            text-align: center;
            color: #6b7280;
          }
        </style>
      </head>
      <body class="bg-white p-8">
        <!-- Page 1 -->
        <div class="mb-8">
          <h1 class="text-4xl font-bold mb-2">${slideData.title}</h1>
          <p class="text-xl text-gray-600">${slideData.subtitle}</p>
          <div class="mt-4 h-1 w-32 bg-blue-600"></div>
        </div>
        
        <div class="grid grid-cols-4 gap-4 mb-8">
          ${slideData.keyMetrics.map((metric: KeyMetric) => `
            <div class="metric-box">
              <p class="text-sm text-gray-600 font-medium">${metric.label}</p>
              <p class="text-2xl font-bold">
                ${metric.value}
                ${metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'}
              </p>
            </div>
          `).join('')}
        </div>
        
        <div class="grid grid-cols-2 gap-6 mb-8">
          <div class="border border-gray-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold mb-4">Phase Distribution</h3>
            <div class="chart-placeholder">
              <p class="font-semibold mb-2">Phase Distribution Chart</p>
              ${slideData.chartData.phaseChart.map((item: any) => 
                `<div>${item.name}: ${item.value}</div>`
              ).join('')}
            </div>
          </div>
          
          <div class="border border-gray-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold mb-4">Trial Status</h3>
            <div class="chart-placeholder">
              <p class="font-semibold mb-2">Status Distribution Chart</p>
              ${slideData.chartData.statusChart.map((item: any) => 
                `<div>${item.name}: ${item.value}</div>`
              ).join('')}
            </div>
          </div>
        </div>
        
        <div class="page-break"></div>
        
        <!-- Page 2 -->
        <div class="grid grid-cols-2 gap-6 mb-8">
          <div class="border border-gray-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold mb-4">Top Sponsors</h3>
            <div class="chart-placeholder">
              ${slideData.chartData.sponsorChart.map((item: any, index: number) => 
                `<div>${index + 1}. ${item.name}: ${item.value}</div>`
              ).join('')}
            </div>
          </div>
          
          <div class="border border-gray-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold mb-4">Activity Timeline</h3>
            <div class="chart-placeholder">
              ${slideData.chartData.yearChart.map((item: any) => 
                `<div>${item.year}: ${item.value} trials</div>`
              ).join('')}
            </div>
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-6 mb-8">
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold mb-4">Competitive Landscape</h3>
            <ul class="space-y-2">
              ${slideData.competitiveLandscape.map((insight: string, index: number) => `
                <li class="flex items-start">
                  <span class="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold mr-3 flex-shrink-0">
                    ${index + 1}
                  </span>
                  <span class="text-gray-700">${insight}</span>
                </li>
              `).join('')}
            </ul>
          </div>
          
          <div class="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold mb-4">Market Trend Analysis</h3>
            <p class="text-gray-700">${slideData.trendAnalysis}</p>
          </div>
        </div>
        
        <div class="bg-blue-600 text-white rounded-lg p-6 mb-8 no-break">
          <h3 class="text-xl font-semibold mb-3">Strategic Recommendation</h3>
          <p class="text-lg">${slideData.recommendation}</p>
        </div>
        
        <div class="border-t pt-6 text-sm text-gray-500 flex justify-between">
          <p>Query: "${query}"</p>
          <p>Generated by ABCresearch • ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
    </html>
  `;
};

export function Slide({ slideData, onClose, query, trials = [], onSaveSuccess }: SlideProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const PHASE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const STATUS_COLORS = ['#10b981', '#3b82f6', '#6b7280', '#f59e0b'];
  
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const handlePrint = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      alert('Please allow pop-ups to export the PDF');
      return;
    }
    
    // Generate the complete HTML content
    const printHTML = generatePrintHTML(slideData, query);
    
    // Write the content to the new window
    printWindow.document.write(printHTML);
    printWindow.document.close();
    
    // Trigger print after a short delay
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        // Close window after print dialog
        printWindow.onafterprint = () => {
          printWindow.close();
        };
      }, 500);
    };
  };

  const handleSaveMarketMap = async () => {
    if (!saveName.trim()) return;
    
    setSaving(true);
    setSaveError(null);
    
    try {
      await MarketMapService.saveMarketMap({
        name: saveName.trim(),
        query,
        trials_data: trials,
        slide_data: slideData,
      });
      
      setShowSaveDialog(false);
      setSaveName('');
      onSaveSuccess?.();
    } catch (error) {
      console.error('Error saving market map:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save market map');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSaveDialog = () => {
    setSaveName(slideData.title || `Market Map - ${query}`);
    setShowSaveDialog(true);
    setSaveError(null);
  };

  return (
    <>
      {/* Full screen light background overlay */}
      <div className="fixed inset-0 z-30" style={{ backgroundColor: 'rgb(249, 250, 251)' }} />
      
      <div className="slide-light-theme fixed inset-x-0 top-16 bottom-0 z-40 flex items-center justify-center p-4 print:inset-0 print:p-0" style={{ backgroundColor: 'rgb(249, 250, 251)' }}>
      <div className="rounded-lg max-w-7xl w-full max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:rounded-none shadow-lg" style={{ backgroundColor: 'white' }}>
        {/* Header with controls */}
        <div className="flex justify-between items-center p-4 border-b print:hidden">
          <h2 className="text-lg font-semibold">Executive Market Analysis</h2>
          <div className="flex gap-2">
            <Button
              onClick={handleOpenSaveDialog}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Map
            </Button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              <Download className="h-4 w-4" />
              Export PDF
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
          {/* Executive Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {slideData.title}
            </h1>
            <p className="text-xl text-gray-600">{slideData.subtitle}</p>
            <div className="mt-4 h-1 w-32 bg-blue-600"></div>
          </div>

          {/* Key Metrics Dashboard */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {slideData.keyMetrics.map((metric, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm text-gray-600 font-medium">{metric.label}</p>
                  {getTrendIcon(metric.trend)}
                </div>
                <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
              </div>
            ))}
          </div>

          {/* Data Visualization Grid */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Phase Distribution */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Phase Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={slideData.chartData.phaseChart}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {slideData.chartData.phaseChart.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PHASE_COLORS[index % PHASE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Sponsor Analysis */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Sponsors</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={slideData.chartData.sponsorChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Status Distribution */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Trial Status Overview</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={slideData.chartData.statusChart}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {slideData.chartData.statusChart.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Temporal Trends */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Activity Timeline</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={slideData.chartData.yearChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Competitive Landscape */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Competitive Landscape</h3>
              <ul className="space-y-3">
                {slideData.competitiveLandscape.map((insight, index) => (
                  <li key={index} className="flex items-start">
                    <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">
                      {index + 1}
                    </span>
                    <p className="text-gray-700 flex-1">{insight}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Market Trend Analysis</h3>
              <p className="text-gray-700 leading-relaxed">{slideData.trendAnalysis}</p>
            </div>
          </div>

          {/* Strategic Recommendation */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg p-6 mb-8">
            <h3 className="text-xl font-semibold mb-3">Strategic Recommendation</h3>
            <p className="text-lg leading-relaxed">{slideData.recommendation}</p>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center text-sm text-gray-500 pt-6 border-t">
            <p>Query: "{query}"</p>
            <p>Generated by ABCresearch • {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page {
              size: A4;
              margin: 10mm;
            }
            
            /* Hide print button */
            .print\\:hidden {
              display: none !important;
            }
            
            /* Fix modal positioning for print */
            .fixed {
              position: absolute !important;
            }
            
            /* Remove modal constraints */
            .max-h-\\[90vh\\] {
              max-height: none !important;
            }
            
            .overflow-y-auto {
              overflow: visible !important;
            }
            
            /* Ensure content spans full width */
            .max-w-7xl {
              max-width: 100% !important;
            }
            
            /* Fix chart containers for print */
            .recharts-responsive-container {
              width: 100% !important;
              height: 250px !important;
              page-break-inside: avoid !important;
            }
            
            /* Ensure grids don't break */
            .grid {
              page-break-inside: avoid !important;
            }
            
            /* Color preservation */
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            /* Force page breaks between major sections */
            .mb-8:nth-of-type(3) {
              page-break-before: always !important;
            }
            
            /* Keep recommendation box together */
            .bg-gradient-to-r {
              page-break-inside: avoid !important;
            }
          }
          
          /* Force light theme for slide container */
          .slide-light-theme {
            --background: 0 0% 98% !important;
            --foreground: 0 0% 15% !important;
            background-color: rgb(249, 250, 251) !important;
          }
        `
      }} />

      {/* Save Dialog Modal */}
      {showSaveDialog && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="rounded-lg p-6 w-full max-w-md mx-4 border shadow-lg" style={{ backgroundColor: 'white' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Save Market Map</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSaveDialog(false)}
                className="p-1"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Map Name
                </label>
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Enter a name for your market map"
                  className="w-full"
                />
              </div>
              
              {saveError && (
                <div className="text-sm text-red-600">
                  {saveError}
                </div>
              )}
              
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowSaveDialog(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveMarketMap}
                  disabled={saving || !saveName.trim()}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}