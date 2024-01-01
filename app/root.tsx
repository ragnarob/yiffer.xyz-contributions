import type {
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from '@remix-run/cloudflare';
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from '@remix-run/react';
import type { UserSession } from './types/types';
import { ThemeProvider, useTheme } from './utils/theme-provider';
import styles from './styles/app.css';
import rootStyles from './styles/main.css';
import clsx from 'clsx';
import toastCss from 'react-toastify/dist/ReactToastify.css';
import { getThemeSession } from './utils/theme.server';
import { getUserSession } from './utils/auth.server';
import {
  RiAccountCircleLine,
  RiAddLine,
  RiLoginBoxLine,
  RiLogoutBoxLine,
  RiSettings3Line,
} from 'react-icons/ri';
import Link from './ui-components/Link';
import { MdLightbulbOutline } from 'react-icons/md';
import { useState } from 'react';
// import * as Sentry from '@sentry/browser';

// Sentry.init({
//   dsn: 'https://74fe377e56b149fa9f1fa9d41d5de90b@o4504978928959488.ingest.sentry.io/4504978941542400',
//   integrations: [new Sentry.BrowserTracing()],
//   // Alternatively, use `process.env.npm_package_version` for a dynamic release version
//   // if your build tool supports it.
//   // Set tracesSampleRate to 1.0 to capture 100%
//   // of transactions for performance monitoring.
//   // We recommend adjusting this value in production
//   tracesSampleRate: 1.0,
// });

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: 'favicon.png',
    type: 'image/png',
  },
  { rel: 'stylesheet', href: styles },
  { rel: 'stylesheet', href: rootStyles },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Mulish:wght@300;600&display=swap',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Shrikhand&text=Yiffer.xyz&display=swap',
  },
  { rel: 'stylesheet', href: toastCss },
];

export const meta: MetaFunction = () => [
  { title: 'Remix Starter' },
  { property: 'og:title', content: 'Remix Starter' },
  { name: 'description', content: 'This Yiffer yoffer yiffer' },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const themeSession = await getThemeSession(request);
  const userSession = await getUserSession(request, context.JWT_CONFIG_STR);

  const data = {
    theme: themeSession.getTheme(),
    user: userSession,
    frontPageUrl: context.FRONT_PAGE_URL,
  };
  return data;
}

export default function AppWithProviders() {
  const data = useLoaderData<typeof loader>();

  return (
    <ThemeProvider specifiedTheme={data.theme}>
      <App />
    </ThemeProvider>
  );
}

function App() {
  const [theme] = useTheme();
  const data = useLoaderData<typeof loader>();

  return (
    <html lang="en" className={clsx(theme)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="dark:bg-bgDark text-text-light dark:text-text-dark">
        <Layout frontPageUrl={data.frontPageUrl} user={data.user}>
          <Outlet />
        </Layout>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
        {/* <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(data.ENV)}`,
          }}
        /> */}
      </body>
    </html>
  );
}

function Layout({
  frontPageUrl,
  user,
  children,
}: {
  frontPageUrl: string;
  user: UserSession | null;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useTheme();
  const isLoggedIn = !!user;
  const isMod = user?.userType === 'admin' || user?.userType === 'moderator';

  return (
    <>
      <nav
        className="flex bg-gradient-to-r from-theme1-primary to-theme2-primary dark:bg-none
          px-4 py-1.5 nav-shadowing justify-between mb-4 text-gray-400 w-full z-20"
      >
        <div className="flex items-center justify-between mx-auto flex-grow max-w-full lg:max-w-80p">
          <div className="flex gap-3 sm:gap-5 items-center">
            <a
              href={frontPageUrl}
              className="text-gray-400 hidden lg:block bg-none dark:text-blue-strong-300 mr-1"
              style={{
                fontFamily: 'Shrikhand,cursive',
                fontSize: '1.25rem',
                fontWeight: 400,
              }}
            >
              Yiffer.xyz
            </a>
            <a
              href={frontPageUrl}
              className="text-gray-400 block lg:hidden bg-none dark:text-blue-strong-300 mr-1"
              style={{
                fontFamily: 'Shrikhand,cursive',
                fontSize: '1.25rem',
                fontWeight: 400,
              }}
            >
              Y
            </a>
            <>
              {isLoggedIn && (
                <Link
                  href="/account"
                  className="text-gray-400 font-semibold bg-none dark:text-blue-strong-300 text-sm"
                  iconMargin={2}
                  text="Me"
                  Icon={RiAccountCircleLine}
                />
              )}
              {isLoggedIn && isMod && (
                <Link
                  href="/admin"
                  className="text-gray-400 font-semibold bg-none dark:text-blue-strong-300 text-sm"
                  iconMargin={2}
                  text="Mod"
                  Icon={RiSettings3Line}
                />
              )}
              <Link
                href="/contribute"
                className="text-gray-400 font-semibold bg-none dark:text-blue-strong-300 text-sm -ml-1"
                iconMargin={2}
                text="Contribute"
                Icon={RiAddLine}
              />
              {isLoggedIn && (
                <a
                  href="/logout"
                  className="font-semibold bg-none dark:text-blue-strong-300 text-sm"
                >
                  <RiLogoutBoxLine className="inline-block mr-0.5" />
                  Log out
                </a>
              )}
            </>
            {!isLoggedIn && (
              <a
                href="/login"
                className="text-gray-400 font-semibold bg-none dark:text-blue-strong-300 text-sm"
              >
                <RiLoginBoxLine className="inline-block" />
                Log in
              </a>
            )}
          </div>

          <div
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="cursor-pointer dark:text-blue-strong-300"
            data-popover-target="popover-hover"
            data-popover-trigger="hover"
          >
            <MdLightbulbOutline className="mb-1" />
          </div>
        </div>
      </nav>

      {children}
    </>
  );
}
