import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const providers = {
  openai: {
    client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    defaultModel: 'gpt-3.5-turbo',
    async chat(messages, model, stream = false) {
      const response = await this.client.chat.completions.create({
        model: model || this.defaultModel,
        messages,
        stream,
        max_tokens: 2048,
      });
      return response;
    },
  },
  anthropic: {
    defaultModel: 'claude-3-haiku-20240307',
    async chat(messages, model, stream = false) {
      // Anthropic via OpenAI-compatible endpoint
      const client = new OpenAI({
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: 'https://api.anthropic.com/v1/',
      });

      // Convert to Anthropic format: separate system message
      const systemMsg = messages.find((m) => m.role === 'system');
      const nonSystemMsgs = messages.filter((m) => m.role !== 'system');

      const response = await client.chat.completions.create({
        model: model || this.defaultModel,
        messages: nonSystemMsgs,
        ...(systemMsg && { system: systemMsg.content }),
        stream,
        max_tokens: 2048,
      });
      return response;
    },
  },
};

export function getProvider(name) {
  const provider = providers[name || process.env.DEFAULT_AI_PROVIDER || 'openai'];
  if (!provider) throw new Error(`Unknown AI provider: ${name}`);
  return provider;
}

export function getDefaultModel(providerName) {
  const provider = getProvider(providerName);
  return provider.defaultModel;
}
