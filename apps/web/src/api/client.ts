const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export const tokenStore = {
  get: () => localStorage.getItem("maritime_token"),
  set: (token: string) => localStorage.setItem("maritime_token", token),
  clear: () => localStorage.removeItem("maritime_token")
};

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message);
  }

  return response.json();
}
