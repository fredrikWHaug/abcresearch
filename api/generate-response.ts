// Vercel API Route for generating dynamic AI responses

interface GenerateResponseRequest {
  userQuery: string;
  searchResults: {
    trials: any[];
    papers: any[];
    totalCount: number;
    searchStrategies: {
      primary: { count: number; trials: any[] };
      alternative: { count: number; trials: any[] };
      broad: { count: number; trials: any[] };
    };
  };
}

interface GenerateResponseResponse {
  success: boolean;
  response: string;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userQuery, searchResults }: GenerateResponseRequest = req.body;

    if (!userQuery || !searchResults) {
      return res.status(400).json({ error: 'User query and search results are required' });
    }

    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Google Gemini API key not configured' });
    }

    // Prepare the data for the AI
    const { trials, papers, totalCount, searchStrategies } = searchResults;
    
    // Analyze the results for the AI
    const recruitingCount = trials.filter((t: any) => t.overallStatus === 'RECRUITING').length;
    const phase3Count = trials.filter((t: any) => t.phase?.some((p: string) => p.includes('3'))).length;
    const topSponsors = [...new Set(trials.map((t: any) => t.sponsors?.lead).filter(Boolean))].slice(0, 3);
    const recentPapers = papers.filter((p: any) => {
      const year = new Date(p.publicationDate).getFullYear();
      return year >= new Date().getFullYear() - 2;
    }).length;

    const prompt = `You are a helpful medical research assistant. A user searched for: "${userQuery}"

Here are the search results:

CLINICAL TRIALS FOUND: ${totalCount}
- Currently recruiting: ${recruitingCount}
- Phase 3 trials: ${phase3Count}
- Top sponsors: ${topSponsors.join(', ') || 'None identified'}

RESEARCH PAPERS FOUND: ${papers.length}
- Recent papers (last 2 years): ${recentPapers}

SEARCH STRATEGY BREAKDOWN:
- Primary search: ${searchStrategies.primary.count} trials
- Alternative search: ${searchStrategies.alternative.count} trials  
- Broad search: ${searchStrategies.broad.count} trials

Generate a natural, conversational response that:
1. Acknowledges what the user was looking for
2. Summarizes what you found in an engaging way
3. Highlights the most interesting or relevant findings
4. Mentions both clinical trials and research papers if both were found
5. Provides helpful context about the results
6. Keeps the tone professional but conversational
7. If no results found, suggest alternative search terms

Keep the response concise (2-3 sentences) and natural. Don't use bullet points or lists.`;

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
          temperature: 0.7,
          maxOutputTokens: 500,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      
      // Fallback to a simple response if Gemini fails
      return res.status(200).json({
        success: true,
        response: `I found ${totalCount} clinical trials and ${papers.length} research papers for "${userQuery}". The results are displayed in the Research and Market Map tabs.`
      });
    }

    const data = await response.json();
    const aiResponse = data.candidates[0].content.parts[0].text;

    return res.status(200).json({
      success: true,
      response: aiResponse
    });

  } catch (error) {
    console.error('Error generating response:', error);
    return res.status(500).json({ error: 'Failed to generate response' });
  }
}
