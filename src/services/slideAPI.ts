import type { ClinicalTrial } from './clinicalTrialsAPI';

export interface SlideData {
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
