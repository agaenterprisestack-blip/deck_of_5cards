export const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');

export async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${SERVER_URL}/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error('Unexpected server response. Check the backend URL.');
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed.');
    error.status = response.status;
    throw error;
  }
  return data;
}
