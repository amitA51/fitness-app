// ============================================================================
// AI Core - Provider-agnostic AI interface with factory pattern
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProvider {
  chat(messages: ChatMessage[]): Promise<string>;
  isAvailable(): boolean;
}

export interface AIConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

// LocalFallbackProvider - rule-based, no API needed
export class LocalFallbackProvider implements AIProvider {
  isAvailable(): boolean {
    return true;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const query = lastUserMessage?.content.toLowerCase() || '';

    // Rule-based responses for fitness queries (in Hebrew)
    if (query.includes('משקל') || query.includes('weight')) {
      return 'המלצה: העלה משקל ב-2.5% אם השלמת את כל החזרות בקלות בשבוע שעבר. אם לא הצלחת, שמור על אותו משקל.';
    }
    if (query.includes('חזרות') || query.includes('reps')) {
      return 'להיפרטרופיה: 8-12 חזרות. לכוח: 3-6 חזרות. לסיבולת: 15+ חזרות. שמור על טכניקה נכונה לפני שמוסיף משקל.';
    }
    if (query.includes('מנוחה') || query.includes('rest')) {
      return 'זמן מנוחה מומלץ: כוח כבד - 3-5 דקות. היפרטרופיה - 60-90 שניות. סיבולת - 30-60 שניות.';
    }
    if (query.includes('תזונה') || query.includes('nutrition') || query.includes('אוכל')) {
      return 'לבניית שריר: 1.6-2.2ג חלבון לק"ג גוף. עודף קלורי של 300-500 קלוריות. שים דגש על חלבון בכל ארוחה.';
    }
    if (query.includes('שינה') || query.includes('sleep')) {
      return 'שינה היא קריטית להתאוששות ובניית שריר. שאף ל-7-9 שעות שינה בכל לילה. הימנע ממסכים שעה לפני השינה.';
    }
    return 'המשך להתאמן בעקביות, שמור על תזונה מאוזנת ומספיק שינה. עקביות היא המפתח לתוצאות!';
  }
}

// RemoteProvider - for future API connection
export class RemoteProvider implements AIProvider {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  isAvailable(): boolean {
    return !!(this.config.apiKey && this.config.model);
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    // Will be implemented when user provides API details
    // For now, fall back to local provider
    const fallback = new LocalFallbackProvider();
    return fallback.chat(messages);
  }
}

let currentProvider: AIProvider = new LocalFallbackProvider();

export function getAIProvider(): AIProvider {
  return currentProvider;
}

export function setAIProvider(config: AIConfig): void {
  if (config.apiKey && config.model) {
    currentProvider = new RemoteProvider(config);
  } else {
    currentProvider = new LocalFallbackProvider();
  }
}

export function resetAIProvider(): void {
  currentProvider = new LocalFallbackProvider();
}
