"use client";

import { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  username: string;
  is_admin: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isLoading: boolean;
}
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://sdu-112:8005/';
export { BACKEND_URL };
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Set default configuration for axios
const api = axios.create({
  baseURL: BACKEND_URL+"api", // Your backend API address
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
    delete api.defaults.headers.common['Authorization'];
  };

  // 添加响应拦截器来处理401和403错误（认证失败）
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          // Token失效或权限不足，执行登出操作
          logout();
          // 重定向到登录页面
          router.push('/login');
          return Promise.reject(error);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      // 在组件卸载时移除拦截器
      api.interceptors.response.eject(interceptor);
    };
  }, [router]);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      api.get('/users/me')
        .then(response => setUser(response.data))
        .catch(() => {
          // Token invalid, clear
          logout();
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setIsLoading(true);
    api.get('/users/me')
      .then(response => setUser(response.data))
      .finally(() => setIsLoading(false));
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { api }; // Export the configured axios instance