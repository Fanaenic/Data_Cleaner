export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id?: number;
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

export interface DetectedObject {
  class: string;
  confidence: number;
  bbox: number[];
}

export interface ImageData {
  id: number;
  filename: string;
  original_name: string;
  created_at: string;
  url: string;
  processed: boolean;
  detected_objects?: DetectedObject[];
  detected_count: number;
}