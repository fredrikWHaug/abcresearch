// Vercel API Route for conversational drug discovery

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface DrugConversationRequest {
  userMessage: string;
  conversationHistory: Message[];
}

interface DrugSuggestion {
  drugName: string;
  genericName?: string;
  category: string;
  description: string;
}

interface DrugConversationResponse {
  success: boolean;
  assistantMessage: string;
  isReadyToSearch: boolean;
  finalDrugs?: string[];
  suggestedDrugs?: DrugSuggestion[];
  clarificationNeeded?: {
    question: string;
    options?: string[];
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userMessage, conversationHistory }: DrugConversationRequest = req.body;

    if (!userMessage) {
      return res.status(400).json({ error: 'User message is required' });
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    // Build conversation context for Claude
    const conversationContext = conversationHistory
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    const systemPrompt = `You are a knowledgeable pharmaceutical research assistant helping users discover specific drugs for their research. Your goal is to have a natural conversation to narrow down EXACTLY which drugs the user wants to search for.

IMPORTANT GUIDELINES:
1. Start broad and progressively narrow down the search
2. Ask clarifying questions about:
   - Therapeutic area (oncology, cardiology, neurology, etc.)
   - Drug class/mechanism of action (kinase inhibitors, antibodies, etc.)
   - Specific targets or pathways
   - Development stage (approved, investigational, specific phase)
   - Administration route if relevant
   - Any specific companies or sponsors
3. Suggest specific drugs when the scope is narrow enough
4. DO NOT proceed to search until you have a specific list of 3-20 drugs identified
5. Be conversational and helpful, not robotic

When you have narrowed down to specific drugs, you MUST respond with a JSON object in this EXACT format:
{
  "ready": true,
  "drugs": ["Drug Name 1", "Drug Name 2", "Drug Name 3"],
  "message": "Your conversational response to the user"
}

If you need more clarification, respond with:
{
  "ready": false,
  "message": "Your clarifying question",
  "suggestions": ["Option 1", "Option 2", "Option 3"]
}

Current conversation:
${conversationContext}

User's latest message: "${userMessage}"

Respond thoughtfully to continue the conversation or finalize the drug list.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: systemPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      throw new Error(`Failed to get AI response: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.content[0].text;

    // Try to parse JSON response from Claude
    let parsedResponse;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      let cleanedResponse = aiResponse.trim();
      if (cleanedResponse.includes('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```/g, '');
      } else if (cleanedResponse.includes('```')) {
        cleanedResponse = cleanedResponse.replace(/```\s*/g, '');
      }
      
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', aiResponse);
      // Fallback: treat as plain text conversation
      parsedResponse = {
        ready: false,
        message: aiResponse,
        suggestions: []
      };
    }

    // Build the response
    const result: DrugConversationResponse = {
      success: true,
      assistantMessage: parsedResponse.message,
      isReadyToSearch: parsedResponse.ready === true,
      finalDrugs: parsedResponse.ready ? parsedResponse.drugs : undefined,
      clarificationNeeded: !parsedResponse.ready ? {
        question: parsedResponse.message,
        options: parsedResponse.suggestions || []
      } : undefined
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('Error in drug conversation:', error);
    return res.status(500).json({ 
      error: 'Failed to process conversation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

