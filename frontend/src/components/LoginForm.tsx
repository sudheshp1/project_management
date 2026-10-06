import { useState, type FormEvent } from "react";
import { login } from "@/lib/auth";

type LoginFormProps = {
  onLogin: (username: string) => void;
};

const inputClassName =
  "w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]";

export const LoginForm = ({ onLogin }: LoginFormProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await login(username, password)) {
      onLogin(username);
    } else {
      setError(true);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)]"
      >
        <h1 className="font-display text-3xl font-semibold text-[var(--navy-dark)]">
          Sign in
        </h1>
        <label className="block space-y-1 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
          <span>Username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            className={inputClassName}
            required
          />
        </label>
        <label className="block space-y-1 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className={inputClassName}
            required
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            Invalid username or password.
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
        >
          Sign in
        </button>
      </form>
    </main>
  );
};
