export const getCurrentUser = async (): Promise<string | null> => {
  const response = await fetch("/api/me");
  if (!response.ok) {
    return null;
  }
  const { username } = await response.json();
  return username;
};

export const login = async (
  username: string,
  password: string
): Promise<boolean> => {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return response.ok;
};

export const logout = async (): Promise<void> => {
  await fetch("/api/logout", { method: "POST" });
};
