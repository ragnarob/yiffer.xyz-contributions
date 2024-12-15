import { useNavigate } from '@remix-run/react';
import TextInput from '~/ui-components/TextInput/TextInput';
import { useState } from 'react';
import LoadingButton from '~/ui-components/Buttons/LoadingButton';
import Button from '~/ui-components/Buttons/Button';
import { create400Json, createSuccessJson, makeDbErr } from '~/utils/request-helpers';
import { queryDbExec } from '~/utils/database-facade';
import { useGoodFetcher } from '~/utils/useGoodFetcher';
import Textarea from '~/ui-components/Textarea/Textarea';
import { redirectIfNotAdmin } from '~/utils/loaders';
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
export { AdminErrorBoundary as ErrorBoundary } from '~/utils/error';

export default function NewBlog() {
  const navigate = useNavigate();

  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');

  const submitFetcher = useGoodFetcher({
    method: 'post',
    toastSuccessMessage: `Blog created`,
    toastError: true,
    onFinish: () => {
      navigate('/admin/blogs');
    },
  });

  async function onSubmit() {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    await submitFetcher.awaitSubmit(formData);
  }

  function onCancel() {
    navigate('/admin/blogs');
  }

  return (
    <div className="mt-2">
      <h2>New blog</h2>

      <TextInput
        label="Title"
        value={title}
        onChange={setTitle}
        className="max-w-xs mt-4"
      />

      <Textarea
        label="Blog text"
        value={content}
        onChange={setContent}
        name="blogText"
        className="mt-8 max-w-4xl"
      />

      <div className="flex flex-row gap-3">
        <Button text="Cancel" variant="outlined" onClick={onCancel} className="mt-4" />

        <LoadingButton
          isLoading={false}
          text="Create blog"
          onClick={onSubmit}
          className="mt-4"
          disabled={content.length < 5 || title.length < 2}
        />
      </div>
    </div>
  );
}

export async function action(args: ActionFunctionArgs) {
  const user = await redirectIfNotAdmin(args);

  const data = await args.request.formData();
  const title = data.get('title');
  const content = data.get('content');

  if (!title) return create400Json('Title is required');
  if (!content) return create400Json('Blog text is required');

  const query = 'INSERT INTO blog (title, content, author) VALUES (?, ?, ?)';
  const params = [title.toString(), content.toString(), user.userId];

  const dbRes = await queryDbExec(args.context.cloudflare.env.DB, query, params);
  if (dbRes.isError) {
    return makeDbErr(dbRes, 'Error creating blog', {
      title: title.toString(),
      content: content.toString(),
    });
  }

  return createSuccessJson();
}
