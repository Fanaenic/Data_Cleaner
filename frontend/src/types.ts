// src/types.ts

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  name: string; // username
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id?: number; // Может быть, если возвращается из бэкенда
    name: string;
    email: string;
  };
}

export interface UserData {
  token: string;
  user: {
    id?: number;
    name: string;
    email: string;
  };
}

export interface AuthProps {
  onLogin: (userData: UserData) => void;
}

export interface MainAppProps {
  user: UserData;
  onLogout: () => void;
}


export interface ImageData {
  id: number;
  filename: string;
  original_name: string;
  created_at: string;
}

