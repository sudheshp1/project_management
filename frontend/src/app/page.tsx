"use client";

import { useCallback, useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser, logout } from "@/lib/auth";

export default function Home() {
  const [user, setUser] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setUser(null);
  }, []);

  if (user === undefined) {
    return null;
  }

  if (user === null) {
    return <LoginForm onLogin={setUser} />;
  }

  return <KanbanBoard onLogout={handleLogout} />;
}
