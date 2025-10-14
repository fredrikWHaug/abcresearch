// Service for conversational drug discovery

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface DrugSuggestion {
  drugName: string;
  genericName?: string;
  category: string;
  description: string;
}

export interface ConversationResponse {
  success: boolean;
  assistantMessage: string;
  isReadyToSearch: boolean;
  finalDrugs?: string[];
  clarificationNeeded?: {
    question: string;
    options?: string[];
  };
}

export class DrugDiscoveryAPI {
  /**
   * Send a message in the drug discovery conversation
   */
  static async sendMessage(
    userMessage: string,
    conversationHistory: Message[]
  ): Promise<ConversationResponse> {
    try {
      const response = await fetch('/api/drug-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage,
          conversationHistory
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data: ConversationResponse = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to process conversation');
      }

      return data;
    } catch (error) {
      console.error('Error in drug discovery conversation:', error);
      throw error;
    }
  }
}

