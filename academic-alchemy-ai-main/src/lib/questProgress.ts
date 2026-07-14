const API_URL = import.meta.env.VITE_API_URL || "/api";

export const reportQuestProgress = async (questType: string, increment = 1): Promise<void> => {
  const token = localStorage.getItem("token");
  if (!token) return;
  try {
    await fetch(`${API_URL}/pokemon/quests/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ questType, increment }),
    });
  } catch { /* silent — quest progress is non-critical */ }
};
