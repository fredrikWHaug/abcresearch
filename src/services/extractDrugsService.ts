// Service for extracting drug interventions from clinical trials and papers using Gemini AI

import type { ClinicalTrial } from './clinicalTrialsAPI';
import type { PubMedArticle } from './pubmedAPI';

export interface ExtractedDrug {
  name: string;
  type: string; // 'drug', 'device', 'procedure', 'other'
  confidence: number; // 0-100
  source: 'clinical_trial' | 'paper';
  sourceId: string; // NCT ID or PMID
}

export interface DrugExtractionResult {
  drugs: ExtractedDrug[];
  success: boolean;
  error?: string;
}

export class ExtractDrugsService {
  /**
   * Extract drugs from clinical trials and papers
   */
  static async extractDrugs(
    trials: ClinicalTrial[],
    papers: PubMedArticle[]
  ): Promise<DrugExtractionResult> {
    console.log('💊 ExtractDrugsService.extractDrugs called');
    console.log(`📊 Processing ${trials.length} trials and ${papers.length} papers`);
    
    try {
      const allDrugs: ExtractedDrug[] = [];
      
      // Extract drugs from clinical trials
      const trialDrugs = await this.extractDrugsFromTrials(trials);
      allDrugs.push(...trialDrugs);
      
      // Extract drugs from papers
      const paperDrugs = await this.extractDrugsFromPapers(papers);
      allDrugs.push(...paperDrugs);
      
      console.log(`✅ Successfully extracted ${allDrugs.length} drug interventions`);
      
      return {
        drugs: allDrugs,
        success: true
      };
    } catch (error) {
      console.error('❌ Error extracting drugs:', error);
      return {
        drugs: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Extract drugs from clinical trials using Gemini AI
   */
  private static async extractDrugsFromTrials(trials: ClinicalTrial[]): Promise<ExtractedDrug[]> {
    const drugs: ExtractedDrug[] = [];
    
    // Process trials in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < trials.length; i += batchSize) {
      const batch = trials.slice(i, i + batchSize);
      const batchDrugs = await Promise.all(
        batch.map(trial => this.extractDrugsFromSingleTrial(trial))
      );
      drugs.push(...batchDrugs.flat());
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < trials.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return drugs;
  }

  /**
   * Extract drugs from a single clinical trial
   */
  private static async extractDrugsFromSingleTrial(trial: ClinicalTrial): Promise<ExtractedDrug[]> {
    try {
      // Use the interventions field from ClinicalTrials.gov
      if (!trial.interventions || trial.interventions.length === 0) {
        return [];
      }
      
      const interventionsText = trial.interventions.join('; ');
      
      const prompt = `Extract drug names from the following clinical trial interventions. 
Focus on identifying actual drug names, not procedures or devices.

Clinical Trial: ${trial.briefTitle}
Interventions: ${interventionsText}

Return ONLY a JSON array of drug names (no explanations, no markdown):
["drug1", "drug2", "drug3"]

Rules:
- Only include actual drug names (e.g., "aspirin", "metformin", "pembrolizumab")
- Exclude procedures (e.g., "surgery", "radiation therapy")
- Exclude devices (e.g., "pacemaker", "stent")
- Exclude placebos and controls
- Use standard drug names, not brand names when possible
- If no drugs found, return empty array: []`;

      const extractedDrugs = await this.callGeminiAPI(prompt);
      
      return extractedDrugs.map((drugName: string) => ({
        name: drugName,
        type: 'drug',
        confidence: 90, // High confidence for ClinicalTrials.gov data
        source: 'clinical_trial',
        sourceId: trial.nctId
      }));
    } catch (error) {
      console.error(`❌ Error extracting drugs from trial ${trial.nctId}:`, error);
      return [];
    }
  }

  /**
   * Extract drugs from papers using Gemini AI
   */
  private static async extractDrugsFromPapers(papers: PubMedArticle[]): Promise<ExtractedDrug[]> {
    const drugs: ExtractedDrug[] = [];
    
    // Process papers in batches
    const batchSize = 3; // Smaller batches for papers due to longer text
    for (let i = 0; i < papers.length; i += batchSize) {
      const batch = papers.slice(i, i + batchSize);
      const batchDrugs = await Promise.all(
        batch.map(paper => this.extractDrugsFromSinglePaper(paper))
      );
      drugs.push(...batchDrugs.flat());
      
      // Add delay between batches
      if (i + batchSize < papers.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    return drugs;
  }

  /**
   * Extract drugs from a single paper
   */
  private static async extractDrugsFromSinglePaper(paper: PubMedArticle): Promise<ExtractedDrug[]> {
    try {
      const prompt = `Extract drug names from the following research paper title and abstract.
Focus on identifying actual drug names mentioned in the study.

Title: ${paper.title}
Abstract: ${paper.abstract}

Return ONLY a JSON array of drug names (no explanations, no markdown):
["drug1", "drug2", "drug3"]

Rules:
- Only include actual drug names (e.g., "aspirin", "metformin", "pembrolizumab")
- Exclude procedures (e.g., "surgery", "radiation therapy")
- Exclude devices (e.g., "pacemaker", "stent")
- Exclude placebos and controls
- Use standard drug names, not brand names when possible
- If no drugs found, return empty array: []`;

      const extractedDrugs = await this.callGeminiAPI(prompt);
      
      return extractedDrugs.map((drugName: string) => ({
        name: drugName,
        type: 'drug',
        confidence: 75, // Lower confidence for paper extraction
        source: 'paper',
        sourceId: paper.pmid
      }));
    } catch (error) {
      console.error(`❌ Error extracting drugs from paper ${paper.pmid}:`, error);
      return [];
    }
  }

  /**
   * Call Gemini API to extract drugs
   */
  private static async callGeminiAPI(prompt: string): Promise<string[]> {
    try {
      const geminiApiKey = import.meta.env.VITE_GOOGLE_GEMINI_API_KEY;
      
      if (!geminiApiKey) {
        console.error('❌ Google Gemini API key not configured');
        return [];
      }

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`;
      
      const requestBody = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.1, // Low temperature for consistent extraction
          maxOutputTokens: 500,
        }
      };

      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Gemini API error:', errorText);
        return [];
      }

      const data = await response.json();
      const content = data.candidates[0].content.parts[0].text;
      
      // Parse the JSON response
      let extractedDrugs: string[] = [];
      try {
        // Clean the response - remove any markdown formatting
        let cleanedContent = content.trim();
        
        // Remove markdown code blocks if present
        if (cleanedContent.startsWith('```json')) {
          cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedContent.startsWith('```')) {
          cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Find JSON array in the response
        const jsonMatch = cleanedContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cleanedContent = jsonMatch[0];
        }
        
        extractedDrugs = JSON.parse(cleanedContent);
        
        // Ensure it's an array of strings
        if (Array.isArray(extractedDrugs)) {
          extractedDrugs = extractedDrugs.filter(drug => typeof drug === 'string' && drug.trim().length > 0);
        } else {
          extractedDrugs = [];
        }
      } catch (parseError) {
        console.error('❌ Failed to parse Gemini response:', content);
        console.error('❌ Parse error:', parseError);
        return [];
      }
      
      return extractedDrugs;
    } catch (error) {
      console.error('❌ Error calling Gemini API:', error);
      return [];
    }
  }

  /**
   * Normalize drug names to handle variations
   */
  static normalizeDrugName(drugName: string): string {
    return drugName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Group drugs by normalized names to handle variations
   */
  static groupDrugsByName(drugs: ExtractedDrug[]): Map<string, ExtractedDrug[]> {
    const grouped = new Map<string, ExtractedDrug[]>();
    
    for (const drug of drugs) {
      const normalizedName = this.normalizeDrugName(drug.name);
      
      if (!grouped.has(normalizedName)) {
        grouped.set(normalizedName, []);
      }
      
      grouped.get(normalizedName)!.push(drug);
    }
    
    return grouped;
  }

  /**
   * Get the most common name for a group of drugs
   */
  static getMostCommonDrugName(drugs: ExtractedDrug[]): string {
    if (drugs.length === 0) return '';
    
    // Count occurrences of each name
    const nameCounts = new Map<string, number>();
    
    for (const drug of drugs) {
      const name = drug.name;
      nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    }
    
    // Return the most common name
    let mostCommon = '';
    let maxCount = 0;
    
    for (const [name, count] of nameCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = name;
      }
    }
    
    return mostCommon;
  }
}
