// Deduplicate Drugs API
// Server-side endpoint for deduplicating drug names using Gemini LLM

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface DrugInfo {
  name: string;
  type?: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
  sourceType: 'trial' | 'paper';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { drugs } = req.body as { drugs: DrugInfo[] };

    if (!drugs || !Array.isArray(drugs)) {
      return res.status(400).json({ error: 'Invalid request: drugs array required' });
    }

    // If list is small or empty, no need for LLM deduplication
    if (drugs.length <= 1) {
      return res.status(200).json({ success: true, drugs });
    }

    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ 
        error: 'Gemini API key not configured',
        details: 'GOOGLE_GEMINI_API_KEY environment variable is not set'
      });
    }

    // Extract just the drug names for simpler LLM processing
    const drugNames = drugs.map(d => d.name);

    const prompt = `You are a pharmaceutical expert. Deduplicate this list of drug names by merging synonyms, brand/generic names, and spelling variations.

DRUG NAMES (${drugNames.length} total):
${drugNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

RULES:
- Merge brand names with generic names (e.g., "Keytruda" and "Pembrolizumab" → keep "Pembrolizumab")
- Merge spelling variations (e.g., "Nivolumab" and "nivolumab" → keep "Nivolumab")
- Merge abbreviations with full names (keep the full name)
- If unsure whether two drugs are the same, keep both separate
- Prefer generic/scientific names over brand names
- Return ONE name for each unique drug

Return ONLY a JSON array of the deduplicated drug names (just strings, no objects):

["Drug Name 1", "Drug Name 2", "Drug Name 3"]

IMPORTANT: Return ONLY the JSON array, no markdown, no explanations, no code blocks.`;

    // Call Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error during deduplication:', errorText);
      return res.status(500).json({ 
        error: `Gemini API failed with status ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;

    // Parse response with robust cleaning
    let cleanedContent = content.trim();
    
    // Remove markdown code blocks
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Extract JSON array (find first [ to last ])
    const firstBracket = cleanedContent.indexOf('[');
    const lastBracket = cleanedContent.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      cleanedContent = cleanedContent.substring(firstBracket, lastBracket + 1);
    }

    // Fix common JSON errors from LLMs
    // Remove trailing commas before ] or }
    cleanedContent = cleanedContent.replace(/,(\s*[\]}])/g, '$1');
    
    // Remove comments (// and /* */)
    cleanedContent = cleanedContent.replace(/\/\/.*$/gm, '');
    cleanedContent = cleanedContent.replace(/\/\*[\s\S]*?\*\//g, '');

    let deduplicatedNames: string[];
    try {
      deduplicatedNames = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse deduplication response:', cleanedContent);
      console.error('Parse error:', parseError);
      return res.status(500).json({
        error: 'Invalid JSON in deduplication response',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      });
    }
    
    if (!Array.isArray(deduplicatedNames)) {
      console.error('Invalid deduplication response - expected array:', deduplicatedNames);
      return res.status(500).json({
        error: 'Invalid response format from Gemini API',
        details: 'Expected array of strings'
      });
    }
    
    console.log(`LLM deduplication: ${drugs.length} → ${deduplicatedNames.length} drugs`);
    
    // Reconstruct DrugInfo objects from deduplicated names
    // For each deduplicated name, find the best matching original drug entry
    const deduplicatedDrugs: DrugInfo[] = deduplicatedNames.map(deduplicatedName => {
      // Find all original drugs that might match this deduplicated name
      const matches = drugs.filter(drug => 
        drug.name.toLowerCase() === deduplicatedName.toLowerCase() ||
        deduplicatedName.toLowerCase().includes(drug.name.toLowerCase()) ||
        drug.name.toLowerCase().includes(deduplicatedName.toLowerCase())
      );
      
      if (matches.length === 0) {
        // No match found, use first drug as template
        return {
          ...drugs[0],
          name: deduplicatedName
        };
      }
      
      // Use the match with highest confidence
      const bestMatch = matches.sort((a, b) => {
        const confidenceOrder = { high: 3, medium: 2, low: 1 };
        return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
      })[0];
      
      // Combine sources from all matches
      const combinedSources = matches.map(m => m.source).filter((v, i, a) => a.indexOf(v) === i).join(', ');
      
      return {
        name: deduplicatedName,
        type: bestMatch.type,
        confidence: bestMatch.confidence,
        source: combinedSources,
        sourceType: bestMatch.sourceType
      };
    });
    
    return res.status(200).json({ 
      success: true, 
      drugs: deduplicatedDrugs,
      originalCount: drugs.length,
      deduplicatedCount: deduplicatedDrugs.length
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in drug deduplication:', errorMsg);
    return res.status(500).json({ 
      error: 'Drug deduplication failed',
      details: errorMsg
    });
  }
}

