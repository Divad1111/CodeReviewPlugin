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
   * Analyze a code diff or full source against coding standards.
   */
  async analyzeDiff(
    filePath: string,
    content: string,
    standards: string,
    logger?: (msg: string) => void,
    configOverride?: { endpoint: string; modelName: string; apiKey?: string },
    isFullSource: boolean = false
  ): Promise<AIAnalysisResult> {
    const settings = getSettings();
    const config = configOverride || getAIModelByName(settings.aiModel);

    if (!config) {
      throw new Error(`AI Model '${settings.aiModel}' not found.`);
    }

    if (!config.apiKey) {
      const modelDisplayName = (config as any).name || 'Override';
      throw new Error(`API Key for model '${modelDisplayName}' is not configured.`);
    }

    const prompt = this.buildPrompt(filePath, content, standards || 'Check for bugs and common naming issues.', isFullSource);

    let endpoint = config.endpoint.trim();
    const modelName = config.modelName;

    // Normalize endpoint: ensure it ends with /chat/completions for OpenAI-compatible APIs
    if (!endpoint.endsWith('/chat/completions')) {
      endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
    }

    const systemPrompt = isFullSource 
      ? 'You are a senior code reviewer. Analyze the provided FULL FILE content and return a valid JSON object with a "comments" array. Each comment MUST have "line" (number), "text" (string), and optional "codeSnippet". Focus on coding standards, bugs, and overall architecture. Return ONLY JSON.'
      : 'You are a senior code reviewer. Analyze the provided diff and return a valid JSON object with a "comments" array. Each comment MUST have "line" (number, relative to the diff or file), "text" (string), and optional "codeSnippet". Focus on coding standards and bugs. Return ONLY JSON.';

    const requestBody = {
      model: modelName,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    };

    if (logger) {
      logger(`>>> AI REQUEST to ${endpoint}:\n${JSON.stringify(requestBody, null, 2)}`);
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errText = await response.text();
        if (logger) { logger(`<<< AI ERROR (${response.status}): ${errText}`); }
        throw new Error(`AI API error (${response.status}): ${errText}`);
      }

      const data: any = await response.json();
      if (logger) {
        logger(`<<< AI RESPONSE:\n${JSON.stringify(data, null, 2)}`);
      }
      const content = data.choices[0].message.content;
      return JSON.parse(content) as AIAnalysisResult;
    } catch (err: any) {
      throw new Error(`AI Analysis failed: ${err.message}`);
    }
  }

  private buildPrompt(filePath: string, content: string, standards: string, isFullSource: boolean): string {
    return `
      File Path: ${filePath}
      
      Coding Standards:
      ${standards}
      
      ${isFullSource ? 'Full Source Code to analyze:' : 'Diff to analyze:'}
      ${content}
    `;
  }
}

