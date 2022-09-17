// import bcrypt from 'bcryptjs';
import { createCookieSessionStorage, redirect } from '@remix-run/cloudflare';
import jwt from '@tsndr/cloudflare-worker-jwt';

export async function login(username: string, password: string) {
  // TODO find user, check password with bcrypt
  console.log({ username, password });
  const userFromDb = { id: 1, username: 'Melon' };
  return await createUserSession(userFromDb.id, userFromDb.username);
}

// TODO use cloudflare KV to store/get these?
const sessionSecret = 'testsecret';
const cookieName = 'yiffer-auth-test';
const secure = false;
const cookieMaxAge = 86400 * 30;
const tokenSecret = 'asdasdasdtokensecret';

const storage = createCookieSessionStorage({
  cookie: {
    name: cookieName,
    secure,
    secrets: [sessionSecret],
    sameSite: 'lax',
    path: '/',
    maxAge: cookieMaxAge,
    httpOnly: true,
  },
});

// To only get the user data - {userId, username, token (auth)}
// Basically, use this from components/routes
export async function getUserSessionData(request: Request) {
  const session = await getUserSession(request);
  if (session && session.data) {
    return session.data;
  }
  return null;
}

// To get the full session object, needed when manipulating the session itself
export async function getUserSession(request: Request) {
  const session = await storage.getSession(request.headers.get('cookie'));
  const token = session.get('token');

  if (!token) {
    return null;
  }

  const isTokenValid = await jwt.verify(token, tokenSecret);
  if (!isTokenValid) {
    storage.destroySession(session);
    return null;
  }

  return session;
}

export async function getUser(request: Request) {
  const userId = await getUserId(request);
  if (userId === null) {
    return null;
  }

  // TODO lookup full user in db
  const userFromDb = { id: 1, username: 'Melon' };
  return userFromDb;
}

export async function getUserId(request: Request) {
  const session = await getUserSession(request);
  if (!session) {
    return null;
  }
  const userId = session.get('userId');
  if (!userId || typeof userId !== 'string') {
    return null;
  }
  return userId;
}

// Place in the loader of routes requiring a logged in user
export async function requireUserId(request: Request) {
  const session = await getUserSession(request);
  if (!session) {
    throw redirect(`/`);
  }
  const userId = session.get('userId');
  if (!userId || typeof userId !== 'string') {
    throw redirect(`/`);
  }
  return userId;
}

export async function logout(request: Request) {
  const session = await getUserSession(request);
  if (!session) {
    return redirect('/');
  }
  return redirect('/', {
    headers: {
      'Set-Cookie': await storage.destroySession(session),
    },
  });
}

export async function createUserSession(userId: number, username: string) {
  const session = await storage.getSession();
  const token = await jwt.sign({ userId }, tokenSecret);
  session.set('token', token);
  session.set('userId', userId);
  session.set('username', username);

  const cookie = await storage.commitSession(session);

  return redirect('/', {
    headers: {
      'Set-Cookie': cookie,
    },
  });
}