import OpenAI from 'openai';

export function getClient(provider) {
  const name = provider || process.env.DEFAULT_AI_PROVIDER || 'openai';

  if (name === 'anthropic') {
    return {
      client: new OpenAI({
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: 'https://api.anthropic.com/v1/',
      }),
      defaultModel: 'claude-3-haiku-20240307',
    };
  }

  return {
    client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    defaultModel: process.env.DEFAULT_AI_MODEL || 'gpt-3.5-turbo',
  };
}
