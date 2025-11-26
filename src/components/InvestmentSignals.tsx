import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, AlertCircle, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Signal {
  rating: 'OUTPERFORM' | 'HOLD' | 'UNDERPERFORM';
  content: string;
}

interface InvestmentSignalsProps {
  isVisible?: boolean;
}

export function InvestmentSignals({ isVisible = true }: InvestmentSignalsProps = {}) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);
  const [updatesAnalyzed, setUpdatesAnalyzed] = useState<number>(0);

  const generateSignals = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch('/api/investment-signals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate investment signals');
      }

      const data = await response.json();
      setSignals(data.signals || []);
      setUpdatesAnalyzed(data.updatesAnalyzed || 0);
      setLastGenerated(new Date(data.generatedAt));
    } catch (err) {
      console.error('Failed to generate investment signals:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate investment signals');
    } finally {
      setLoading(false);
    }
  };

  const getRatingConfig = (rating: string) => {
    switch (rating) {
      case 'OUTPERFORM':
        return {
          label: 'Outperform',
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          borderColor: 'border-green-300',
          icon: <TrendingUp className="w-4 h-4" />,
        };
      case 'UNDERPERFORM':
        return {
          label: 'Underperform',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          borderColor: 'border-red-300',
          icon: <TrendingDown className="w-4 h-4" />,
        };
      case 'HOLD':
      default:
        return {
          label: 'Hold',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          borderColor: 'border-gray-300',
          icon: <Minus className="w-4 h-4" />,
        };
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Card className="p-6 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="p-2 bg-purple-600 rounded-lg">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">AI Investment Signals</h2>
            <p className="text-xs text-gray-600">
              Analyst-grade insights from recent trial updates
            </p>
          </div>
        </div>
        <button
          onClick={generateSignals}
          disabled={loading}
          className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          title={loading ? "Analyzing..." : "Refresh Signals"}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-red-800">{error}</span>
        </div>
      )}

      {signals.length === 0 && !loading && !error && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
          <p className="text-gray-600 text-sm mb-1">No signals generated yet</p>
          <p className="text-gray-500 text-xs">
            Click "Refresh Signals" to analyze your recent trial updates
          </p>
        </div>
      )}

      {signals.length > 0 && (
        <div className="space-y-4">
          {/* Signals List */}
          <div className="space-y-3">
            {signals.map((signal, idx) => {
              const ratingConfig = getRatingConfig(signal.rating);
              
              // Parse "Sponsor: insight" format from content
              const parts = signal.content.split(':');
              const sponsor = parts[0]?.trim();
              const insight = parts.slice(1).join(':').trim();
              
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-4 bg-white border border-purple-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white font-bold rounded-full flex-shrink-0 text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Rating Badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${ratingConfig.bgColor} ${ratingConfig.textColor} ${ratingConfig.borderColor}`}>
                        {ratingConfig.icon}
                        {ratingConfig.label}
                      </span>
                    </div>
                    
                    {/* Signal Content */}
                    {sponsor && insight ? (
                      <>
                        <div className="font-semibold text-purple-900 text-sm mb-1">
                          {sponsor}
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed">
                          {insight}
                        </p>
                      </>
                    ) : (
                      <p className="text-gray-700 text-sm leading-relaxed">
                        {signal.content}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Metadata Footer */}
          {lastGenerated && (
            <div className="pt-3 border-t border-purple-200">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  Generated: {lastGenerated.toLocaleString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    hour: 'numeric', 
                    minute: '2-digit' 
                  })}
                </span>
                {updatesAnalyzed > 0 && (
                  <span>
                    Analyzed {updatesAnalyzed} update{updatesAnalyzed !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            <strong>Disclaimer:</strong> AI-generated signals are for informational purposes only. 
            Not investment advice. Conduct thorough due diligence before making investment decisions.
          </div>
        </div>
      )}
    </Card>
  );
}

