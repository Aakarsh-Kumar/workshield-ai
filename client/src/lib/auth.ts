import Cookies from 'js-cookie';

const TOKEN_KEY = 'ws_token';

const cookieOptions: Cookies.CookieAttributes = {
  expires: 7,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
};

export const setToken = (token: string): void => {
  Cookies.set(TOKEN_KEY, token, cookieOptions);
};

export const getToken = (): string | undefined => Cookies.get(TOKEN_KEY);

export const clearToken = (): void => Cookies.remove(TOKEN_KEY);

export const isAuthenticated = (): boolean => !!getToken();
