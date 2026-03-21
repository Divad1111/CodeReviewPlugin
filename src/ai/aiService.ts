import { getSettings, getAIModelByName } from '../storage/settingsRepo';

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
    standards: string
  ): Promise<AIAnalysisResult> {
    const settings = getSettings();
    const config = getAIModelByName(settings.aiModel);

    if (!config) {
      throw new Error(`AI Model '${settings.aiModel}' not found.`);
    }

    if (!config.apiKey) {
      throw new Error(`API Key for model '${config.name}' is not configured.`);
    }

    const prompt = this.buildPrompt(filePath, diff, standards || 'Check for bugs and common naming issues.');

    let endpoint = config.endpoint.trim();
    const modelName = config.modelName;

    // Normalize endpoint: ensure it ends with /chat/completions for OpenAI-compatible APIs
    if (!endpoint.endsWith('/chat/completions')) {
      endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
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
}

