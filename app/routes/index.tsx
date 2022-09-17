import { MdHome } from 'react-icons/md';
import Link from '../components/Link';
import { getUserSessionData } from '../utils/auth.server';
import { useLoaderData } from '@remix-run/react';
import { LoaderFunction } from '@remix-run/cloudflare';

export const loader: LoaderFunction = async function ({ request }) {
  // It seems we must do this all places where user login status
  // is required. Using Context lead to trouble with SSR.
  const userSession = await getUserSessionData(request);
  const data = {
    user: userSession,
  };
  return data;
};

export default function Index() {
  const { user } = useLoaderData();

  return (
    <div>
      <h1 className="text-center">Contribute</h1>
      <p className="text-center mx-auto">
        <Link href="https://yiffer.xyz" text="To main page" Icon={MdHome} />
      </p>

      <div className="max-w-4xl mx-auto mt p-4 grid gap-4 grid-cols-1 sm:grid-cols-2 sm:gap-8 sm:p-8">
        <ContributionCard
          title="Upload a comic yourself"
          description="Add files yourself, in addition to specifying artist, tags, and more"
          href="upload"
        />
        <ContributionCard
          title="Suggest a comic"
          description="Suggest a comic for the mod team to upload, providing links and what information you can"
          href="suggest-comic"
        />
        <ContributionCard
          title="Your contributions"
          description="See the status and history of your previous contributions"
          href="your-contributions"
          disabled={!user}
        >
          <p className="text-center">Requires login</p>
        </ContributionCard>
        <ContributionCard
          title="Contributions scoreboard"
          description="See the monthly and all-time top contributors"
          href="scoreboard"
        />
        <ContributionCard
          title="Become a mod"
          description="Be a part of the incredible team that keeps this site running!"
          href="join-us"
        />
        <ContributionCard
          title="Feedback"
          description="Have any tips for how Yiffer.xyz could be better? Let us know!"
          href="feedback"
        />
      </div>
    </div>
  );
}

type ContributionCardProps = {
  title: string;
  description: string;
  href: string;
  disabled?: boolean;
  children?: React.ReactNode;
};

function ContributionCard({
  title,
  description,
  href,
  disabled,
  children,
}: ContributionCardProps) {
  return disabled ? (
    <div
      className="rounded-lg p-4 h-full flex flex-col 
      justify-evenly bg-white dark:bg-gray-300 border-2 border-gray-900 dark:border-0"
    >
      <h2 className="text-theme2-darker dark:text-theme2-dark text-xl text-center font-semibold">
        {title}
      </h2>
      <p className="text-black font-light text-center">{description}</p>
      {children}
    </div>
  ) : (
    <a href={'/' + href} style={{ backgroundImage: 'none' }}>
      <div
        className="rounded-lg shadow-md p-4 hover:shadow-lg h-full flex flex-col 
          justify-evenly bg-white dark:bg-gray-400"
      >
        <h2 className="text-theme2-darker dark:text-theme2-dark text-xl text-center font-semibold">
          {title}
        </h2>
        <p className="text-black font-light text-center">{description}</p>
      </div>
    </a>
  );
}