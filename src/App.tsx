import { useState, useEffect } from 'react';
import { fetchMarketData, MarketData } from './mock-api';
import './App.css';

interface AIInsight {
  id: string;
  text: string;
  confidence: number;
  type: 'trend' | 'risk' | 'opportunity';
}

function App() {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [showAiInsights, setShowAiInsights] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null);

  const generateAIInsights = (marketData: MarketData) => {
    const insights: AIInsight[] = [];
    const activeCount = marketData.statusDistribution.find(s => s.status === 'Active')?.count || 0;
    const phase3Count = marketData.distribution.find(d => d.phase === 'Phase 3')?.count || 0;
    const topCompany = marketData.companyDistribution[0];

    insights.push({
      id: '1',
      text: `Strong market activity detected: ${activeCount} active trials representing ${Math.round(activeCount/marketData.trials.length * 100)}% of the pipeline. This suggests a highly dynamic competitive landscape.`,
      confidence: 94,
      type: 'trend'
    });

    insights.push({
      id: '2',
      text: `${topCompany.company} leads with ${topCompany.count} trials, indicating strategic focus and significant R&D investment in this therapeutic area.`,
      confidence: 92,
      type: 'opportunity'
    });

    insights.push({
      id: '3',
      text: `${phase3Count} trials in Phase 3 suggest near-term market catalysts expected. Monitor for potential FDA approvals within 12-18 months.`,
      confidence: 88,
      type: 'trend'
    });

    insights.push({
      id: '4',
      text: `AI-predicted market consolidation: High trial density may indicate upcoming M&A activity as smaller players seek partnerships.`,
      confidence: 76,
      type: 'risk'
    });

    return insights;
  };

  const handleSearch = async () => {
    setLoading(true);
    setAnimateIn(false);
    setAiProcessing(true);
    setShowAiInsights(false);
    try {
      const result = await fetchMarketData(query);
      setData(result);
      
      // Generate AI insights
      const insights = generateAIInsights(result);
      
      // Simulate AI processing time
      setTimeout(() => {
        setAiProcessing(false);
        setAiInsights(insights);
        setTimeout(() => setShowAiInsights(true), 200);
      }, 1500);
      
      // Trigger animation after data is set
      setTimeout(() => setAnimateIn(true), 50);
    } catch (error) {
      console.error('Error fetching data:', error);
      setAiProcessing(false);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Calculate max counts for chart scaling
  const maxCount = data ? Math.max(...data.distribution.map(d => d.count)) : 0;
  const maxCompanyCount = data ? Math.max(...data.companyDistribution.map(c => c.count)) : 0;
  const maxStatusCount = data ? Math.max(...data.statusDistribution.map(s => s.count)) : 0;

  // Auto-trigger initial search for demo
  useEffect(() => {
    handleSearch();
  }, []);

  const handleExploreInsight = (insight: AIInsight) => {
    setSelectedInsight(insight);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToDashboard = () => {
    setSelectedInsight(null);
  };

  // If viewing insight detail, show that page
  if (selectedInsight && data) {
    return (
      <div className="app">
        <div className="container">
          <div className="insight-detail-page">
            <button className="back-button" onClick={handleBackToDashboard}>
              ← Back to Dashboard
            </button>
            
            <div className="insight-detail-header">
              <div className="insight-detail-icon">
                {selectedInsight.type === 'trend' && '📈'}
                {selectedInsight.type === 'risk' && '⚠️'}
                {selectedInsight.type === 'opportunity' && '💡'}
              </div>
              <div>
                <div className="insight-detail-type">{selectedInsight.type.toUpperCase()} ANALYSIS</div>
                <h1 className="insight-detail-title">Deep Dive: AI Market Analysis</h1>
              </div>
              <div className="insight-detail-confidence-large">
                <div className="confidence-circle">
                  <svg viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="confidenceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
                      </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="45" className="confidence-bg" />
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="45" 
                      className="confidence-fill"
                      style={{ strokeDashoffset: `${283 - (283 * selectedInsight.confidence / 100)}` }}
                    />
                  </svg>
                  <div className="confidence-number">{selectedInsight.confidence}%</div>
                </div>
                <div className="confidence-label">AI Confidence</div>
              </div>
            </div>

            <div className="insight-detail-content">
              <section className="insight-section">
                <h2 className="insight-section-title">🧠 AI Analysis Summary</h2>
                <p className="insight-summary">{selectedInsight.text}</p>
              </section>

              <section className="insight-section">
                <h2 className="insight-section-title">📊 Supporting Data</h2>
                <div className="supporting-data-grid">
                  <div className="data-metric">
                    <div className="metric-value">{data.trials.length}</div>
                    <div className="metric-label">Total Trials Analyzed</div>
                  </div>
                  <div className="data-metric">
                    <div className="metric-value">{data.companyDistribution.length}</div>
                    <div className="metric-label">Companies Tracked</div>
                  </div>
                  <div className="data-metric">
                    <div className="metric-value">
                      {data.statusDistribution.find(s => s.status === 'Active')?.count || 0}
                    </div>
                    <div className="metric-label">Active Trials</div>
                  </div>
                  <div className="data-metric">
                    <div className="metric-value">
                      {data.distribution.find(d => d.phase === 'Phase 3')?.count || 0}
                    </div>
                    <div className="metric-label">Phase 3 Trials</div>
                  </div>
                </div>
              </section>

              {selectedInsight.type === 'trend' && (
                <>
                  <section className="insight-section">
                    <h2 className="insight-section-title">📈 Trend Analysis</h2>
                    <div className="trend-timeline">
                      <div className="timeline-item">
                        <div className="timeline-marker timeline-past">✓</div>
                        <div className="timeline-content">
                          <h3>Current State</h3>
                          <p>High market activity with {data.statusDistribution.find(s => s.status === 'Active')?.count} active trials</p>
                        </div>
                      </div>
                      <div className="timeline-item">
                        <div className="timeline-marker timeline-present">⚡</div>
                        <div className="timeline-content">
                          <h3>6-12 Months</h3>
                          <p>Expected Phase 3 readouts and potential regulatory submissions</p>
                        </div>
                      </div>
                      <div className="timeline-item">
                        <div className="timeline-marker timeline-future">🎯</div>
                        <div className="timeline-content">
                          <h3>12-18 Months</h3>
                          <p>Anticipated FDA approvals and market launches for leading candidates</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="insight-section">
                    <h2 className="insight-section-title">💡 AI Recommendations</h2>
                    <div className="recommendations-list">
                      <div className="recommendation-card">
                        <div className="recommendation-icon">📌</div>
                        <div>
                          <h3>Monitor Phase 3 Trials</h3>
                          <p>Set up alerts for {data.distribution.find(d => d.phase === 'Phase 3')?.count} Phase 3 trials approaching readout dates</p>
                        </div>
                      </div>
                      <div className="recommendation-card">
                        <div className="recommendation-icon">🔍</div>
                        <div>
                          <h3>Track Competitive Landscape</h3>
                          <p>Watch for new trial initiations from {data.companyDistribution[0].company} and competitors</p>
                        </div>
                      </div>
                      <div className="recommendation-card">
                        <div className="recommendation-icon">📅</div>
                        <div>
                          <h3>Plan Strategic Reviews</h3>
                          <p>Schedule quarterly reviews to assess market dynamics and competitive positioning</p>
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              )}

              {selectedInsight.type === 'opportunity' && (
                <>
                  <section className="insight-section">
                    <h2 className="insight-section-title">💡 Opportunity Deep Dive</h2>
                    <div className="opportunity-breakdown">
                      <div className="opportunity-card">
                        <h3>🎯 Strategic Focus</h3>
                        <p>{data.companyDistribution[0].company} is demonstrating clear commitment with {data.companyDistribution[0].count} trials in this therapeutic area.</p>
                        <div className="opportunity-stats">
                          <div className="stat">
                            <span className="stat-number">{Math.round(data.companyDistribution[0].count / data.trials.length * 100)}%</span>
                            <span className="stat-desc">Market Share</span>
                          </div>
                          <div className="stat">
                            <span className="stat-number">{data.companyDistribution[0].count}x</span>
                            <span className="stat-desc">Avg Competitor</span>
                          </div>
                        </div>
                      </div>
                      <div className="opportunity-card">
                        <h3>💰 Investment Signals</h3>
                        <p>High trial count indicates significant R&D investment and potential for pipeline expansion or partnerships.</p>
                        <ul className="insight-list">
                          <li>Strong pipeline diversification across phases</li>
                          <li>Multiple mechanisms of action being explored</li>
                          <li>Competitive positioning for market leadership</li>
                        </ul>
                      </div>
                    </div>
                  </section>

                  <section className="insight-section">
                    <h2 className="insight-section-title">🚀 Action Items</h2>
                    <div className="recommendations-list">
                      <div className="recommendation-card">
                        <div className="recommendation-icon">🤝</div>
                        <div>
                          <h3>Partnership Potential</h3>
                          <p>Evaluate collaboration opportunities with leading companies</p>
                        </div>
                      </div>
                      <div className="recommendation-card">
                        <div className="recommendation-icon">📊</div>
                        <div>
                          <h3>Competitive Intelligence</h3>
                          <p>Deep dive into competitor trial designs and endpoints</p>
                        </div>
                      </div>
                      <div className="recommendation-card">
                        <div className="recommendation-icon">💼</div>
                        <div>
                          <h3>Investment Thesis</h3>
                          <p>Build detailed investment case based on pipeline strength</p>
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              )}

              {selectedInsight.type === 'risk' && (
                <>
                  <section className="insight-section">
                    <h2 className="insight-section-title">⚠️ Risk Assessment</h2>
                    <div className="risk-matrix">
                      <div className="risk-card risk-high">
                        <div className="risk-level">High</div>
                        <h3>Market Consolidation</h3>
                        <p>High trial density suggests potential M&A activity. Smaller players may struggle to compete independently.</p>
                      </div>
                      <div className="risk-card risk-medium">
                        <div className="risk-level">Medium</div>
                        <h3>Competitive Pressure</h3>
                        <p>Multiple Phase 3 trials increase likelihood of market crowding and pricing pressure.</p>
                      </div>
                      <div className="risk-card risk-low">
                        <div className="risk-level">Low</div>
                        <h3>Regulatory Risk</h3>
                        <p>Established therapeutic area with clear regulatory pathways reduces approval uncertainty.</p>
                      </div>
                    </div>
                  </section>

                  <section className="insight-section">
                    <h2 className="insight-section-title">🛡️ Mitigation Strategies</h2>
                    <div className="recommendations-list">
                      <div className="recommendation-card">
                        <div className="recommendation-icon">🎯</div>
                        <div>
                          <h3>Strategic Positioning</h3>
                          <p>Focus on differentiation through novel mechanisms or superior efficacy profiles</p>
                        </div>
                      </div>
                      <div className="recommendation-card">
                        <div className="recommendation-icon">🤝</div>
                        <div>
                          <h3>Partnership Strategy</h3>
                          <p>Consider strategic alliances or licensing deals to strengthen market position</p>
                        </div>
                      </div>
                      <div className="recommendation-card">
                        <div className="recommendation-icon">📡</div>
                        <div>
                          <h3>Early Warning System</h3>
                          <p>Implement monitoring for M&A rumors, trial failures, and regulatory setbacks</p>
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              )}

              <section className="insight-section">
                <h2 className="insight-section-title">🤖 AI Methodology</h2>
                <div className="methodology-card">
                  <div className="methodology-item">
                    <div className="methodology-step">1</div>
                    <div>
                      <h3>Data Ingestion</h3>
                      <p>Analyzed {data.trials.length} clinical trials across {data.companyDistribution.length} companies</p>
                    </div>
                  </div>
                  <div className="methodology-item">
                    <div className="methodology-step">2</div>
                    <div>
                      <h3>Pattern Recognition</h3>
                      <p>Applied neural networks to identify trends, anomalies, and correlations</p>
                    </div>
                  </div>
                  <div className="methodology-item">
                    <div className="methodology-step">3</div>
                    <div>
                      <h3>Confidence Scoring</h3>
                      <p>Generated {selectedInsight.confidence}% confidence score based on data quality and pattern strength</p>
                    </div>
                  </div>
                  <div className="methodology-item">
                    <div className="methodology-step">4</div>
                    <div>
                      <h3>Insight Generation</h3>
                      <p>Synthesized findings into actionable strategic recommendations</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1 className="title">Market Landscape Generator</h1>
          <p className="subtitle">Visual Clinical Trial Market Map</p>
          
          <div className="search-bar">
            <div className="search-input-wrapper">
              <input
                type="text"
                className="search-input"
                placeholder="Ask AI anything about the market landscape..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              {aiProcessing && (
                <div className="ai-processing-badge">
                  <span className="ai-sparkle">✨</span>
                  <span>AI Processing</span>
                </div>
              )}
            </div>
            <button className="search-button" onClick={handleSearch} disabled={loading}>
              {loading ? 'Searching...' : (
                <>
                  <span className="ai-icon">🤖</span>
                  AI Search
                </>
              )}
            </button>
          </div>
        </header>

        {loading && (
          <div className="loading-container">
            <div className="spinner"></div>
            <p className="loading-text">Loading market data...</p>
          </div>
        )}

        {data && !loading && (
          <div className={`content ${animateIn ? 'animate-in' : ''}`}>
            {/* Summary Stats Row */}
            <div className="stats-row">
              <div className="stat-card stat-card-1">
                <div className="stat-icon">🧪</div>
                <div className="stat-content">
                  <div className="stat-label">Total Trials</div>
                  <div className="stat-value">{data.trials.length}</div>
                </div>
              </div>
              <div className="stat-card stat-card-2">
                <div className="stat-icon">🏢</div>
                <div className="stat-content">
                  <div className="stat-label">Companies</div>
                  <div className="stat-value">{data.companyDistribution.length}</div>
                </div>
              </div>
              <div className="stat-card stat-card-3">
                <div className="stat-icon live-indicator">⚡</div>
                <div className="stat-content">
                  <div className="stat-label">Active Now</div>
                  <div className="stat-value">
                    {data.statusDistribution.find(s => s.status === 'Active')?.count || 0}
                  </div>
                </div>
              </div>
              <div className="stat-card stat-card-4">
                <div className="stat-icon">📊</div>
                <div className="stat-content">
                  <div className="stat-label">Phase 3+</div>
                  <div className="stat-value">
                    {data.distribution.filter(d => d.phase === 'Phase 3' || d.phase === 'Phase 4').reduce((sum, d) => sum + d.count, 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Insights Panel */}
            {showAiInsights && aiInsights.length > 0 && (
              <div className="ai-insights-panel">
                <div className="ai-insights-header">
                  <div className="ai-insights-title">
                    <span className="ai-brain-icon">🧠</span>
                    <h3>AI-Powered Insights</h3>
                    <span className="ai-badge">Beta</span>
                  </div>
                  <div className="ai-model-info">
                    <span className="ai-model-badge">GPT-4 Enhanced</span>
                  </div>
                </div>
                <div className="ai-insights-grid">
                  {aiInsights.map((insight, index) => (
                    <div 
                      key={insight.id} 
                      className={`ai-insight-card ai-insight-${insight.type}`}
                      style={{ animationDelay: `${index * 0.15}s` }}
                    >
                      <div className="ai-insight-header">
                        <span className={`ai-type-icon ai-type-${insight.type}`}>
                          {insight.type === 'trend' && '📈'}
                          {insight.type === 'risk' && '⚠️'}
                          {insight.type === 'opportunity' && '💡'}
                        </span>
                        <span className="ai-type-label">{insight.type.toUpperCase()}</span>
                        <div className="ai-confidence">
                          <span className="ai-confidence-bar" style={{ width: `${insight.confidence}%` }}></span>
                          <span className="ai-confidence-text">{insight.confidence}%</span>
                        </div>
                      </div>
                      <p className="ai-insight-text">{insight.text}</p>
                      <div className="ai-insight-footer">
                        <span className="ai-timestamp">Generated just now</span>
                        <button className="ai-action-btn" onClick={() => handleExploreInsight(insight)}>
                          Explore →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiProcessing && (
              <div className="ai-insights-panel ai-loading">
                <div className="ai-insights-header">
                  <div className="ai-insights-title">
                    <span className="ai-brain-icon ai-thinking">🧠</span>
                    <h3>AI Analyzing Market Data...</h3>
                  </div>
                </div>
                <div className="ai-processing-animation">
                  <div className="ai-wave"></div>
                  <div className="ai-wave"></div>
                  <div className="ai-wave"></div>
                  <p className="ai-processing-text">Applying neural networks to identify patterns and opportunities</p>
                </div>
              </div>
            )}

            {/* Main Content Grid */}
            <div className="main-grid">
              {/* Clinical Trials Table */}
              <div className="section section-large">
                <h2 className="section-title">
                  <span className="title-icon">📋</span>
                  Clinical Trials Database
                </h2>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Drug</th>
                        <th>Company</th>
                        <th>Phase</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trials.map((trial, index) => (
                        <tr key={trial.id} className="table-row" style={{ animationDelay: `${index * 0.03}s` }}>
                          <td className="drug-name">{trial.drug}</td>
                          <td>{trial.company}</td>
                          <td>
                            <span className={`phase-badge phase-${trial.phase.replace(' ', '-').toLowerCase()}`}>
                              {trial.phase}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge status-${trial.status.toLowerCase()}`}>
                              {trial.status === 'Active' && <span className="status-pulse"></span>}
                              {trial.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Phase Distribution Chart */}
              <div className="section">
                <h2 className="section-title">
                  <span className="title-icon">📈</span>
                  Phase Distribution
                </h2>
                <p className="section-description">Drug pipeline by clinical phase</p>
                <div className="chart-container">
                  {data.distribution.map((item, index) => (
                    <div key={item.phase} className="chart-row" style={{ animationDelay: `${index * 0.1}s` }}>
                      <div className="chart-label">{item.phase}</div>
                      <div className="chart-bar-container">
                        <div 
                          className="chart-bar chart-bar-phase"
                          style={{ 
                            width: `${(item.count / maxCount) * 100}%`,
                            animationDelay: `${index * 0.1}s`
                          }}
                        >
                          <span className="chart-count">{item.count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Company Distribution Chart */}
              <div className="section">
                <h2 className="section-title">
                  <span className="title-icon">🏭</span>
                  Top Companies
                </h2>
                <p className="section-description">Leading organizations by trial count</p>
                <div className="chart-container">
                  {data.companyDistribution.map((item, index) => (
                    <div key={item.company} className="chart-row" style={{ animationDelay: `${index * 0.1}s` }}>
                      <div className="chart-label company-label">{item.company}</div>
                      <div className="chart-bar-container">
                        <div 
                          className="chart-bar chart-bar-company"
                          style={{ 
                            width: `${(item.count / maxCompanyCount) * 100}%`,
                            animationDelay: `${index * 0.1}s`
                          }}
                        >
                          <span className="chart-count">{item.count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="section">
                <h2 className="section-title">
                  <span className="title-icon">⚡</span>
                  Status Breakdown
                </h2>
                <p className="section-description">Trial activity status</p>
                <div className="chart-container">
                  {data.statusDistribution.map((item, index) => (
                    <div key={item.status} className="chart-row" style={{ animationDelay: `${index * 0.1}s` }}>
                      <div className="chart-label">
                        {item.status}
                        {item.status === 'Active' && <span className="live-dot"></span>}
                      </div>
                      <div className="chart-bar-container">
                        <div 
                          className="chart-bar chart-bar-status"
                          style={{ 
                            width: `${(item.count / maxStatusCount) * 100}%`,
                            animationDelay: `${index * 0.1}s`
                          }}
                        >
                          <span className="chart-count">{item.count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {!data && !loading && (
          <div className="empty-state">
            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h3>Start Your Market Research</h3>
            <p>Enter a query above to generate a visual market landscape</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

