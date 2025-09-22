// Vercel API Route for generating slides

interface ClinicalTrial {
  nctId: string;
  briefTitle: string;
  overallStatus: string;
  phase?: string[];
  conditions?: string[];
  sponsors?: {
    lead?: string;
  };
  enrollment?: number;
  startDate?: string;
}

interface SlideRequest {
  trials: ClinicalTrial[];
  query: string;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { trials, query }: SlideRequest = req.body;

    if (!trials || trials.length === 0) {
      return res.status(400).json({ error: 'No trials data provided' });
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    // Prepare data summary for Claude
    const trialsSummary = trials.slice(0, 10).map(trial => ({
      id: trial.nctId,
      title: trial.briefTitle,
      status: trial.overallStatus,
      phase: trial.phase?.[0] || 'Unknown',
      sponsor: trial.sponsors?.lead || 'Unknown',
      enrollment: trial.enrollment || 0,
      conditions: trial.conditions?.slice(0, 2).join(', ') || 'Not specified'
    }));

    const prompt = `You are a biotech analyst creating a professional slide for pharmaceutical executives. 

Query: "${query}"
Clinical Trials Data: ${JSON.stringify(trialsSummary, null, 2)}

Create a professional slide analysis with:

1. **Title**: A compelling title for this market landscape
2. **Key Insights**: 3-4 bullet points of the most important findings
3. **Data Table**: A summary table of the top 5-7 trials with columns: NCT ID, Title (truncated), Phase, Status, Sponsor, Enrollment
4. **Market Summary**: 2-3 sentences about what this data reveals about the competitive landscape

Format your response as JSON with this structure:
{
  "title": "Market Landscape Title",
  "insights": ["Insight 1", "Insight 2", "Insight 3"],
  "tableData": [
    {
      "nctId": "NCT123",
      "title": "Short title...",
      "phase": "Phase 2",
      "status": "Recruiting",
      "sponsor": "Company",
      "enrollment": 100
    }
  ],
  "summary": "Market summary paragraph"
}

Keep titles under 60 characters, insights under 100 characters each, and table titles under 40 characters.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      return res.status(500).json({ error: 'Failed to generate slide content' });
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse the JSON response from Claude
    let slideContent;
    try {
      slideContent = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', content);
      return res.status(500).json({ error: 'Failed to parse generated content' });
    }

    return res.status(200).json({
      success: true,
      slide: slideContent
    });

  } catch (error) {
    console.error('Error generating slide:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
