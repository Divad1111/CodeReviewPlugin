/**
 * AI Service: Handles communication with various AI providers.
 */

import { AppSettings } from '../storage/settingsRepo';

export interface AIAnalysisResult {
  comments: {
    line: number;
    text: string;
    codeSnippet?: string;
  }[];
}

export class AIService {
  /**
   * Analyze a code diff against coding standards.
   */
  async analyzeDiff(
    filePath: string,
    diff: string,
    settings: AppSettings
  ): Promise<AIAnalysisResult> {
    if (!settings.aiApiKey) {
      throw new Error('AI API Key is not configured in settings.');
    }

    const prompt = this.buildPrompt(filePath, diff, settings.codingStandards || 'Check for bugs and common naming issues.');
    
    // For now, I'll implement a generic fetch to a supporting endpoint or DeepSeek as default
    // In a real production app, we'd use specific SDKs for each provider.
    // For this demonstration, I'll use a generic OpenAI-compatible fetch.
    
    const endpoint = this.getEndpoint(settings.aiModel);
    const modelName = this.getModelName(settings.aiModel);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.aiApiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { 
              role: 'system', 
              content: 'You are a senior code reviewer. Analyze the provided diff and return a valid JSON object with a "comments" array. Each comment MUST have "line" (number, relative to the diff or file), "text" (string), and optional "codeSnippet". Focus on coding standards and bugs. Return ONLY JSON.'
            },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`AI API error (${response.status}): ${errText}`);
      }

      const data: any = await response.json();
      const content = data.choices[0].message.content;
      return JSON.parse(content) as AIAnalysisResult;
    } catch (err: any) {
      throw new Error(`AI Analysis failed: ${err.message}`);
    }
  }

  private buildPrompt(filePath: string, diff: string, standards: string): string {
    return `
      File Path: ${filePath}
      
      Coding Standards:
      ${standards}
      
      Diff to analyze:
      ${diff}
    `;
  }

  private getEndpoint(model: string): string {
    switch (model) {
      case 'DeepSeek': return 'https://api.deepseek.com/v1/chat/completions';
      case 'OpenAI': return 'https://api.openai.com/v1/chat/completions';
      case 'Qianwen': return 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
      // ... others would go here
      default: return 'https://api.deepseek.com/v1/chat/completions';
    }
  }

  private getModelName(model: string): string {
    switch (model) {
      case 'DeepSeek': return 'deepseek-chat';
      case 'OpenAI': return 'gpt-4-turbo-preview';
      case 'Qianwen': return 'qwen-plus';
      // ... others
      default: return 'deepseek-chat';
    }
  }
}
