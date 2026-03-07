export type User = {
  id: number;
  email: string;
};

export type AuthResponse = {
  token: string;
  refreshToken: string;
  user: User;
};

export type HistoryItem = {
  id: number;
  text: string;
  filename: string | null;
  createdAt: string;
};

export type TranscriptionResponse = {
  text: string;
};
