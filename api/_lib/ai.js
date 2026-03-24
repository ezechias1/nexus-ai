import OpenAI from 'openai';

export function getClient(provider) {
  const name = provider || process.env.DEFAULT_AI_PROVIDER || 'openai';

  if (name === 'anthropic') {
    // Use OpenRouter as a free-compatible proxy for Anthropic models
    // Or fall back to OpenAI if no Anthropic key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('No ANTHROPIC_API_KEY set, falling back to OpenAI');
      return getClient('openai');
    }
    return {
      client: new OpenAI({
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: 'https://api.anthropic.com/v1/',
        defaultHeaders: {
          'anthropic-version': '2023-06-01',
        },
      }),
      defaultModel: 'claude-3-haiku-20240307',
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  return {
    client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    defaultModel: process.env.DEFAULT_AI_MODEL || 'gpt-3.5-turbo',
  };
}
