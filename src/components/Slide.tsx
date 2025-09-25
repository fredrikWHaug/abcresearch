import React from 'react';
import { Download, X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
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
}

export function Slide({ slideData, onClose, query }: SlideProps) {
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
    window.print();
  };

  return (
    <div className="fixed inset-x-0 top-16 bottom-0 bg-gray-50 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header with controls */}
        <div className="flex justify-between items-center p-4 border-b print:hidden">
          <h2 className="text-lg font-semibold">Executive Market Analysis</h2>
          <div className="flex gap-2">
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