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

    // Extract analytical data for visualization
    const phaseDistribution: { [key: string]: number } = {};
    const statusDistribution: { [key: string]: number } = {};
    const sponsorDistribution: { [key: string]: number } = {};
    const enrollmentByPhase: { [key: string]: number[] } = {};
    const yearDistribution: { [key: string]: number } = {};
    
    trials.forEach(trial => {
      // Phase distribution
      const phase = trial.phase?.[0] || 'Not Specified';
      phaseDistribution[phase] = (phaseDistribution[phase] || 0) + 1;
      
      // Status distribution
      const status = trial.overallStatus || 'Unknown';
      statusDistribution[status] = (statusDistribution[status] || 0) + 1;
      
      // Sponsor distribution (top 5)
      const sponsor = trial.sponsors?.lead || 'Unknown';
      sponsorDistribution[sponsor] = (sponsorDistribution[sponsor] || 0) + 1;
      
      // Enrollment by phase
      if (trial.enrollment && phase !== 'Not Specified') {
        if (!enrollmentByPhase[phase]) enrollmentByPhase[phase] = [];
        enrollmentByPhase[phase].push(trial.enrollment);
      }
      
      // Year distribution
      const year = trial.startDate ? new Date(trial.startDate).getFullYear().toString() : 'Unknown';
      if (year !== 'Unknown' && parseInt(year) >= 2020) {
        yearDistribution[year] = (yearDistribution[year] || 0) + 1;
      }
    });
    
    // Calculate average enrollment by phase
    const avgEnrollmentByPhase: { [key: string]: number } = {};
    Object.entries(enrollmentByPhase).forEach(([phase, enrollments]) => {
      avgEnrollmentByPhase[phase] = Math.round(enrollments.reduce((a, b) => a + b, 0) / enrollments.length);
    });
    
    // Get top sponsors
    const topSponsors = Object.entries(sponsorDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([sponsor, count]) => ({ sponsor, count }));

    const prompt = `You are a senior biotech analyst creating an executive-level market analysis slide for pharmaceutical leaders. 

Query: "${query}"
Total Trials Found: ${trials.length}

Key Analytics:
- Phase Distribution: ${JSON.stringify(phaseDistribution)}
- Status Distribution: ${JSON.stringify(statusDistribution)}
- Top 5 Sponsors: ${JSON.stringify(topSponsors)}
- Average Enrollment by Phase: ${JSON.stringify(avgEnrollmentByPhase)}
- Trials by Year (2020+): ${JSON.stringify(yearDistribution)}

Create a data-driven market analysis with:

1. **title**: Executive-level title (under 50 chars)
2. **subtitle**: One-line market context
3. **keyMetrics**: 4 critical metrics with values
4. **competitiveLandscape**: 2-3 insights about market competition
5. **trendAnalysis**: Key trend observation
6. **recommendation**: Strategic recommendation based on data
7. **chartData**: Formatted data for visualization:
   - phaseChart: phase distribution for pie chart
   - statusChart: status distribution for donut chart
   - sponsorChart: top 5 sponsors for bar chart
   - yearChart: year distribution for line chart

Format your response as JSON with this exact structure:
{
  "title": "string",
  "subtitle": "string",
  "keyMetrics": [
    {"label": "string", "value": "string", "trend": "up|down|neutral"}
  ],
  "competitiveLandscape": ["string"],
  "trendAnalysis": "string",
  "recommendation": "string",
  "chartData": {
    "phaseChart": [{"name": "string", "value": number}],
    "statusChart": [{"name": "string", "value": number}],
    "sponsorChart": [{"name": "string", "value": number}],
    "yearChart": [{"year": "string", "value": number}]
  }
}

Focus on actionable insights, not just descriptions. Think like a McKinsey consultant.`;

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
