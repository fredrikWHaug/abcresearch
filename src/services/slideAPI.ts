 
import type { ClinicalTrial } from '@/types/trials';

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

export interface SlideData {
  title: string;
  subtitle: string;
  keyMetrics: KeyMetric[];
  competitiveLandscape: string[];
  trendAnalysis: string;
  recommendation: string;
  chartData: ChartData;
}

export interface SlideResponse {
  success: boolean;
  slide: SlideData;
}

export class SlideAPI {
  /**
   * Generate a professional slide from clinical trials data
   */
  static async generateSlide(trials: ClinicalTrial[], query: string): Promise<SlideData> {
    try {
      const response = await fetch('/api/generate-slide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trials,
          query
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data: SlideResponse = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to generate slide');
      }

      return data.slide;
    } catch (error) {
      console.error('Error generating slide:', error);
      throw error;
    }
  }
}
