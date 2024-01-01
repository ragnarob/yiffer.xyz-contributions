import { RiArrowRightLine } from 'react-icons/ri';
import Link from '~/ui-components/Link';
import { Link as RemixLink, useLoaderData } from '@remix-run/react';
import { useGoodFetcher } from '~/utils/useGoodFetcher';
import type { Blog } from '~/types/types';
import { useTheme } from '~/utils/theme-provider';
import { authLoader } from '~/utils/loaders';

export { authLoader as loader };

export default function Index() {
  const [theme] = useTheme();
  const userSession = useLoaderData<typeof authLoader>();

  const { data: latestBlog } = useGoodFetcher<Blog>({
    url: '/api/latest-blog',
    fetchGetOnLoad: true,
  });

  return (
    <div className="pb-8">
      <h1
        className="text-center mt-12 dark:text-transparent dark:bg-clip-text w-fit mx-auto text-5xl md:text-7xl"
        style={{
          fontFamily: 'Shrikhand,cursive',
          ...(theme === 'dark' ? darkHeaderStyle : lightHeaderStyle),
        }}
      >
        Yiffer.xyz
      </h1>

      <p className="text-lg md:text-xl text-center md:mb-6 md:mt-2">
        The internet's best collection <br className="block sm:hidden" />
        of quality furry comics
      </p>

      <div className="max-w-xs flex flex-col mx-auto mt-4 gap-4">
        <div className="bg-theme1-primaryTrans rounded h-[90px] flex flex-col items-center justify-center">
          <p className="text-center">
            We are struggling financially.
            <br />
            Please <Link text="support us on Patreon" href="#" />!
          </p>
          <p className="text-center mt-0.5">VIP patron: TODO implement.</p>
        </div>

        <RemixLink to="/browse" className={`w-full`}>
          <div
            className={`h-12 bg-gradient-to-r from-theme1-darker to-theme2-darker text-text-light
            hover:from-theme1-darker2 hover:to-theme2-darker2
            rounded flex flex-row justify-center items-center gap-1 shadow-md`}
          >
            <p className="font-semibold text-white">Browse comics</p>
            <RiArrowRightLine style={{ marginTop: 3 }} className="text-white" />
          </div>
        </RemixLink>

        <RemixLink to={userSession ? '/account' : 'login'} className="w-full mb-2">
          <div
            className={`h-12 bg-theme1-primaryTrans hover:bg-theme1-primaryTransDarker
            rounded flex flex-row justify-center items-center gap-1 shadow-md`}
          >
            {userSession ? <p>My account and profile</p> : <p>Log in or sign up</p>}
            <RiArrowRightLine style={{ marginTop: 3 }} />
          </div>
        </RemixLink>

        <Link
          href="https://pi.yiffer.xyz"
          text="Advertise on Yiffer.xyz"
          IconRight={RiArrowRightLine}
        />

        <Link
          href="/contribute/join-us"
          text="Become a mod"
          IconRight={RiArrowRightLine}
        />

        <Link
          href="/contribute"
          text="Contribute: Upload or suggest comics"
          IconRight={RiArrowRightLine}
        />

        <Link
          href={latestBlog ? `/blog/${latestBlog.id}` : '#'}
          text={`Latest blog: ${latestBlog?.title ?? ''}`}
          IconRight={latestBlog ? RiArrowRightLine : undefined}
        />
      </div>
    </div>
  );
}

const darkHeaderStyle = {
  backgroundImage:
    '-webkit-gradient(linear,left top,right top,color-stop(.2,#49ded7),color-stop(.8,#5df1ba))',
  backgroundClip: 'text',
};
const lightHeaderStyle = {
  color: '#0d0f35',
};
