import { LoaderArgs, redirect } from '@remix-run/cloudflare';
import { getUserSession } from './auth.server';

export async function authLoader(args: LoaderArgs) {
  const userSession = await getUserSession(
    args.request,
    args.context.JWT_CONFIG_STR as string
  );
  return userSession;
}

export async function redirectIfNotLoggedIn(args: LoaderArgs) {
  const user = await authLoader(args);
  if (!user) throw redirect('/');
  return user;
}

export async function redirectIfNotMod(args: LoaderArgs) {
  const user = await authLoader(args);
  if (user?.userType !== 'moderator' && user?.userType !== 'admin') {
    throw redirect('/');
  }
  return user;
}

export async function redirectIfNotAdmin(args: LoaderArgs) {
  const user = await authLoader(args);
  if (user?.userType !== 'admin') {
    throw redirect('/');
  }
  return user;
}
