import { ActionArgs, LoaderArgs } from '@remix-run/cloudflare';
import { useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import { MdArrowBack } from 'react-icons/md';
import LoadingButton from '~/components/Buttons/LoadingButton';
import InfoBox from '~/components/InfoBox';
import Link from '~/components/Link';
import TextareaUncontrolled from '~/components/Textarea/TextareaUncontrolled';
import TextInputUncontrolled from '~/components/TextInput/TextInputUncontrolled';
import TopGradientBox from '~/components/TopGradientBox';
import { getModApplicationForUser } from '~/routes/api/funcs/get-mod-application';
import { queryDb } from '~/utils/database-facade';
import { authLoader, redirectIfNotLoggedIn } from '~/utils/loaders';
import {
  create400Json,
  create500Json,
  createSuccessJson,
  logApiError,
  processApiError,
} from '~/utils/request-helpers';
import { useGoodFetcher } from '~/utils/useGoodFetcher';

export default function Apply() {
  const fetcher = useGoodFetcher({
    method: 'post',
    toastError: false,
    toastSuccessMessage: 'Application submitted!',
    preventToastClose: true,
  });
  const { hasExistingApplication } = useLoaderData<typeof loader>();
  const [notesIsValid, setNotesIsValid] = useState(false);
  const [telegramIsValid, setTelegramIsValid] = useState(false);

  return (
    <div className="container mx-auto">
      <h1>Become a mod</h1>
      <p className="mb-4">
        <Link href="/contribute/join-us" text="Back" Icon={MdArrowBack} />
      </p>

      <p>
        In order to be accepted as a mod, you must have and use a Telegram account. We use
        telegram for communication and announcements for mods. If you do not have a
        telegram account, you will not be accepted.
      </p>

      {hasExistingApplication && (
        <InfoBox
          variant="info"
          showIcon
          text="You already have an existing application. You can see the status of your application on your Account page."
          className="my-4"
        />
      )}

      {!hasExistingApplication && (
        <TopGradientBox containerClassName="w-fit mx-auto my-4" innerClassName="p-8 pb-4">
          <fetcher.Form className="w-fit mx-auto flex flex-col">
            <TextareaUncontrolled
              name="notes"
              label="Tell us a little about why you want to be a mod, and what sources you use for finding comics (which websites):"
              className="mb-12"
              validatorFunc={v => v.length > 0}
              onErrorChange={hasError => setNotesIsValid(!hasError)}
            />

            <TextInputUncontrolled
              name="telegram"
              label="Telegram username (don't include the @ symbol):"
              type="text"
              className="mb-4"
              validatorFunc={validateTelegramUsername}
              onErrorChange={hasError => setTelegramIsValid(!hasError)}
            />

            {fetcher.isError && !fetcher.isLoading && (
              <InfoBox
                variant="error"
                text={fetcher.errorMessage}
                showIcon
                closable
                className="my-4"
              />
            )}

            <div className="flex">
              <LoadingButton
                text="Submit application"
                color="primary"
                variant="contained"
                className="my-4 mx-auto"
                disabled={!notesIsValid || !telegramIsValid}
                isLoading={fetcher.isLoading}
                isSubmit
              />
            </div>
          </fetcher.Form>
        </TopGradientBox>
      )}
    </div>
  );
}

export async function loader(args: LoaderArgs) {
  const user = await redirectIfNotLoggedIn(args);

  const existingApplicationRes = await getModApplicationForUser(
    args.context.DB_API_URL_BASE as string,
    user.userId
  );

  if (existingApplicationRes.err) {
    return processApiError('Error in join us - apply', existingApplicationRes.err);
  }

  return { hasExistingApplication: existingApplicationRes.application !== null };
}

const validateTelegramUsername = (username: string) =>
  /^([a-zA-Z0-9_]){5,32}$/.test(username);

export async function action(args: ActionArgs) {
  const urlBase = args.context.DB_API_URL_BASE as string;
  const reqBody = await args.request.formData();
  const { notes, telegram } = Object.fromEntries(reqBody);

  if (!notes || !telegram) return create400Json('Missing fields');
  if (!validateTelegramUsername(telegram as string))
    return create400Json('Invalid telegram username');

  const user = await authLoader(args);
  if (!user) return create400Json('Not logged in');

  const existingApplicationRes = await getModApplicationForUser(urlBase, user.userId);
  if (existingApplicationRes.err) {
    logApiError('Error creating mod application', existingApplicationRes.err);
    return create500Json();
  }

  if (existingApplicationRes.application) {
    return create400Json('You already have an existing application');
  }

  const insertQuery = `
    INSERT INTO modapplication (userId, telegramUsername, notes)
    VALUES (?, ?, ?)`;
  const insertParams = [user.userId, telegram.toString().trim(), notes];

  const insertDbRes = await queryDb(urlBase, insertQuery, insertParams);
  if (insertDbRes.isError) {
    logApiError(undefined, {
      logMessage: 'Error creating mod application',
      error: insertDbRes,
      context: { userId: user.userId, notes, telegram },
    });
    return create500Json();
  }
  return createSuccessJson();
}
