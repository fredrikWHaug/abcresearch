// src/mock-api.ts
import { mockTrials, Trial } from './mock-data';

export interface MarketData {
  trials: Trial[];
  distribution: { phase: string; count: number }[];
  companyDistribution: { company: string; count: number }[];
  statusDistribution: { status: string; count: number }[];
}

export const fetchMarketData = (query: string): Promise<MarketData> => {
  console.log(`Fetching market data for: ${query}`);
  return new Promise(resolve => {
    setTimeout(() => {
      // Phase distribution
      const distribution = mockTrials.reduce((acc, trial) => {
        const phase = acc.find(p => p.phase === trial.phase);
        if (phase) {
          phase.count++;
        } else {
          acc.push({ phase: trial.phase, count: 1 });
        }
        return acc;
      }, [] as { phase: string; count: number }[]);

      // Company distribution
      const companyDistribution = mockTrials.reduce((acc, trial) => {
        const company = acc.find(c => c.company === trial.company);
        if (company) {
          company.count++;
        } else {
          acc.push({ company: trial.company, count: 1 });
        }
        return acc;
      }, [] as { company: string; count: number }[])
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8 companies

      // Status distribution
      const statusDistribution = mockTrials.reduce((acc, trial) => {
        const status = acc.find(s => s.status === trial.status);
        if (status) {
          status.count++;
        } else {
          acc.push({ status: trial.status, count: 1 });
        }
        return acc;
      }, [] as { status: string; count: number }[]);

      resolve({ trials: mockTrials, distribution, companyDistribution, statusDistribution });
    }, 800); // Simulate network delay
  });
};

