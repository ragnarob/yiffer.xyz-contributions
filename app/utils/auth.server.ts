import { redirect } from '@remix-run/cloudflare';
import jwt from '@tsndr/cloudflare-worker-jwt';
import { JwtConfig, User, UserSession } from '~/types/types';
import { queryDb } from './database-facade';
import { ApiError, makeDbErrObj, wrapApiError } from './request-helpers';
import { createWelcomeEmail, sendEmail } from './send-email';
const bcrypt = require('bcryptjs');
const { hash, compare } = bcrypt;

type AuthResponse = {
  err?: ApiError;
  redirect?: Response;
  errorMessage?: string;
};

type UserWithPassword = User & { password: string };

export async function login(
  username: string,
  password: string,
  urlBase: string,
  jwtConfigStr: string
): Promise<AuthResponse> {
  const { err, errorMessage, user } = await authenticate(urlBase, username, password);
  if (err) {
    return { err: wrapApiError(err, 'Error in login func', { username, password }) };
  }
  if (errorMessage) {
    return { errorMessage };
  }

  const redirect = await createUserSession(user as User, jwtConfigStr);
  return { redirect };
}

export async function signup(
  username: string,
  email: string,
  password: string,
  urlBase: string,
  jwtConfigStr: string,
  postmarkToken: string
): Promise<AuthResponse> {
  const usernameQuery = 'SELECT * FROM user WHERE username = ?';
  const emailQuery = 'SELECT * FROM user WHERE email = ?';

  const [usernameResult, emailResult] = await Promise.all([
    queryDb<any[]>(urlBase, usernameQuery, [username]),
    queryDb<any[]>(urlBase, emailQuery, [email]),
  ]);
  if (usernameResult.isError) {
    return makeDbErrObj(usernameResult, 'Signup error fetching username');
  }
  if (emailResult.isError) {
    return makeDbErrObj(emailResult, 'Signup error fetching email');
  }
  if (usernameResult.result?.length) {
    return { errorMessage: 'Username already exists' };
  }
  if (emailResult.result?.length) {
    return { errorMessage: 'Email already exists' };
  }

  // TODO: prevent spam, as in old api

  const hashedPassword = await hash(password, 8);
  const insertQuery = 'INSERT INTO user (username, password, email) VALUES (?, ?, ?)';
  const insertResult = await queryDb(urlBase, insertQuery, [
    username,
    hashedPassword,
    email,
  ]);
  if (insertResult.isError) {
    return makeDbErrObj(insertResult, 'Error inserting user');
  }
  if (!insertResult.insertId) {
    return makeDbErrObj(insertResult, 'Error inserting user - no insertId');
  }

  const user: User = {
    id: insertResult.insertId,
    username,
    email,
    userType: 'user',
  };

  sendEmail(createWelcomeEmail(username, email), postmarkToken);

  const redirect = await createUserSession(user, jwtConfigStr);

  return { redirect };
}

async function authenticate(
  urlBase: string,
  usernameOrEmail: string,
  password: string
): Promise<{ err?: ApiError; errorMessage?: string; user?: User }> {
  const query =
    'SELECT id, username, email, userType, password FROM user WHERE username = ? OR email = ?';
  const queryParams = [usernameOrEmail, usernameOrEmail];

  const fetchDbRes = await queryDb<UserWithPassword[]>(urlBase, query, queryParams);
  if (fetchDbRes.isError) {
    return makeDbErrObj(fetchDbRes, 'Login error fetching username/email');
  }
  if (!fetchDbRes.result?.length) {
    return { errorMessage: 'Username does not exist or wrong password' };
  }

  const user = fetchDbRes.result[0];
  const isPasswordValid = await compare(password, user.password);
  if (!isPasswordValid) {
    return { errorMessage: 'Username does not exist or wrong password' };
  }

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      userType: user.userType,
    },
  };
}

// To get the user data - {userId, username}
// Basically, use this from components/routes
export async function getUserSession(
  request: Request,
  jwtConfigstr: string
): Promise<UserSession | null> {
  const jwtConfig: JwtConfig = JSON.parse(jwtConfigstr);
  const allCookies = request.headers.get('cookie');

  const sessionCookieContent = cookiesStringToYifferSessionCookie(
    allCookies,
    jwtConfig.cookie.name
  );
  if (!sessionCookieContent) {
    return null;
  }

  const isTokenValid = await jwt.verify(sessionCookieContent, jwtConfig.tokenSecret);
  if (!isTokenValid) {
    return null;
  }

  const tokenContent = jwt.decode(sessionCookieContent);
  if (
    !tokenContent.payload ||
    !tokenContent.payload.id ||
    !tokenContent.payload.username ||
    !tokenContent.payload.userType
  ) {
    return null;
  }

  return {
    userId: tokenContent.payload.id,
    username: tokenContent.payload.username,
    userType: tokenContent.payload.userType,
  };
}

export async function logout(jwtConfigStr: string) {
  const jwtConfig: JwtConfig = JSON.parse(jwtConfigStr);

  const destroyUserDataHeader = destroyUserDataCookieHeader(jwtConfig);
  const destroySessionCookieHeader = destroyJwtAuthCookieHeader(jwtConfig);

  const headers = new Headers();
  headers.append('Set-Cookie', destroySessionCookieHeader);
  headers.append('Set-Cookie', destroyUserDataHeader);

  return redirect('/', { headers });
}

export async function createUserSession(user: User, jwtConfigStr: string) {
  const jwtConfig: JwtConfig = JSON.parse(jwtConfigStr);

  // This one is for auth - will be verified on the server(s)
  const sessionCookieHeader = await createJwtAuthCookieHeader(
    user.id,
    user.username,
    user.userType,
    jwtConfig
  );

  // This one is to ensure cross-subdomain auth, will not need when everything is Remix.
  // This one is not serialized/anything like that, and not httpOnly, so it can be read by the
  // Vue code in the browser - which ensures a smooth experience since that's not SSR.
  const userDataCookieHeader = createUserDataCookieHeader(user, jwtConfig);

  const headers = new Headers();
  headers.append('Set-Cookie', sessionCookieHeader);
  headers.append('Set-Cookie', userDataCookieHeader);

  return redirect('/', {
    headers,
  });
}

async function createJwtAuthCookieHeader(
  userId: number,
  username: string,
  userType: string,
  jwtConfig: JwtConfig
) {
  const token = await jwt.sign({ id: userId, username, userType }, jwtConfig.tokenSecret);
  // Creating it manually, because the Remix methods transform it for some reason??
  return `${jwtConfig.cookie.name}=${token}; Max-Age=${jwtConfig.cookie.maxAge}; Domain=${
    jwtConfig.cookie.domain
  };${jwtConfig.cookie.secure ? ' Secure;' : ''}${
    jwtConfig.cookie.httpOnly ? ' HttpOnly;' : ''
  }`;
}

function destroyJwtAuthCookieHeader(jwtConfig: JwtConfig): string {
  // Creating it manually, because the Remix methods transform it for some reason??
  return `${jwtConfig.cookie.name}=; Max-Age=0; Domain=${jwtConfig.cookie.domain};${
    jwtConfig.cookie.secure ? ' Secure;' : ''
  }${
    jwtConfig.cookie.httpOnly ? ' HttpOnly;' : ''
  } Expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
}

function createUserDataCookieHeader(userData: any, jwtConfig: JwtConfig) {
  // Creating it manually, because the Remix methods transform it for some reason??
  return `yiffer_userdata=${JSON.stringify(userData)}; Max-Age=${
    jwtConfig.cookie.maxAge
  }; Domain=${jwtConfig.cookie.domain}; ${jwtConfig.cookie.secure ? 'Secure' : ''};`;
}

function destroyUserDataCookieHeader(jwtConfig: JwtConfig) {
  // Creating it manually, because the Remix methods transform it for some reason??
  return `yiffer_userdata=; Max-Age=0; Domain=${jwtConfig.cookie.domain}; ${
    jwtConfig.cookie.secure ? 'Secure' : ''
  }; Expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
}

function cookiesStringToYifferSessionCookie(
  allCookies: string | null,
  cookieName: string
): string | undefined {
  if (!allCookies) {
    return;
  }
  const cookiesSplit = allCookies.split(';').map(cookieStr => cookieStr.trim());
  const yifferSessionCookie = cookiesSplit.find(cookie =>
    cookie.startsWith(`${cookieName}=`)
  );
  if (!yifferSessionCookie) {
    return;
  }
  return yifferSessionCookie.slice(cookieName.length + 1);
}
