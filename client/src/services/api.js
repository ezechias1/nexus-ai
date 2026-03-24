const BASE_URL = '/api';

async function request(method, path, body) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
};

// SSE streaming for chat messages with abort support
export function streamMessage(chatId, content, provider, model, onChunk, onDone, onError) {
  const token = localStorage.getItem('token');
  const abortController = new AbortController();

  // 90 second timeout for AI responses
  const timeout = setTimeout(() => {
    abortController.abort();
    onError(new Error('Response timed out'));
  }, 90000);

  fetch(`${BASE_URL}/chat/${chatId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content, provider, model }),
    signal: abortController.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Stream failed' }));
        throw new Error(err.error || 'Stream failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) {
                onDone(data.token_usage);
              } else if (data.error) {
                onError(new Error(data.error));
              } else if (data.content) {
                onChunk(data.content);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err);
      }
    })
    .finally(() => {
      clearTimeout(timeout);
    });

  // Return abort function for cleanup
  return () => {
    clearTimeout(timeout);
    abortController.abort();
  };
}
