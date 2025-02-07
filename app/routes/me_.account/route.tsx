import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/cloudflare';
import { useLoaderData } from '@remix-run/react';
import { format } from 'date-fns';
import { useState } from 'react';
import { MdCheck, MdClose } from 'react-icons/md';
import Breadcrumbs from '~/ui-components/Breadcrumbs/Breadcrumbs';
import Button from '~/ui-components/Buttons/Button';
import InfoBox from '~/ui-components/InfoBox';
import TextInput from '~/ui-components/TextInput/TextInput';
import TopGradientBox from '~/ui-components/TopGradientBox';
import { capitalizeString } from '~/utils/general';
import { fullUserLoader } from '~/utils/loaders';
import { useGoodFetcher } from '~/utils/useGoodFetcher';
export { YifferErrorBoundary as ErrorBoundary } from '~/utils/error';

export const meta: MetaFunction = () => {
  return [{ title: `Account | Yiffer.xyz` }];
};

export async function loader(args: LoaderFunctionArgs) {
  const user = await fullUserLoader(args);
  return { user };
}

export default function AccountPage() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto pb-8">
      <h1>Account settings</h1>

      <Breadcrumbs
        prevRoutes={[{ text: 'Me', href: '/me' }]}
        currentRoute="Account settings"
      />

      <p className="mt-6">
        <span className="font-bold">Username:</span> {user.username}
      </p>

      <p className="mt-2">
        <span className="font-bold">Email:</span> {user.email}
      </p>

      <p className="mt-2">
        <span className="font-bold">User type</span>: {capitalizeString(user.userType)}
      </p>

      <p className="mt-2">
        <span className="font-bold">Account created</span>:{' '}
        {format(user.createdTime, 'PPPP')}
      </p>

      <ChangePassword />
    </div>
  );
}

function ChangePassword() {
  const [isChanging, setIsChanging] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  const submitFetcher = useGoodFetcher({
    url: '/api/change-password',
    method: 'post',
  });

  function cancel() {
    setIsChanging(false);
    setCurrentPassword('');
    setNewPassword('');
    setNewPassword2('');
  }

  async function submit() {
    if (submitFetcher.isLoading) return;

    submitFetcher.submit({
      currentPassword,
      newPassword,
      newPassword2,
    });
  }

  if (!isChanging) {
    return (
      <Button
        text="Change password"
        className="mt-4"
        onClick={() => setIsChanging(true)}
      />
    );
  }

  if (submitFetcher.success) {
    return (
      <InfoBox
        variant="success"
        text="Password changed successfully"
        className="mt-4 w-full sm:w-fit"
      />
    );
  }

  return (
    <div className="mt-4">
      <TopGradientBox
        containerClassName="mt-2 w-full sm:w-[400px]"
        innerClassName="px-4 pb-4 pt-2"
      >
        <h3>Change password</h3>

        <form>
          <TextInput
            type="password"
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            name="current-password"
            className="mt-2"
          />

          <TextInput
            type="password"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            name="new-password"
            className="mt-10"
          />

          <TextInput
            type="password"
            label="Confirm new password"
            value={newPassword2}
            onChange={setNewPassword2}
            name="new-password-again"
            className="mt-10"
          />

          {submitFetcher.isError && (
            <InfoBox variant="error" text={submitFetcher.errorMessage} className="mt-4" />
          )}

          <div className="flex gap-4 mt-8 justify-end">
            <Button
              text="Cancel"
              variant="outlined"
              onClick={cancel}
              startIcon={MdClose}
            />

            <Button text="Submit" startIcon={MdCheck} onClick={submit} />
          </div>
        </form>
      </TopGradientBox>
    </div>
  );
}
