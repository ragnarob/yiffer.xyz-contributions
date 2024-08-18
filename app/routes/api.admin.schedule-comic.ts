import { queryDbMultiple } from '~/utils/database-facade';
import { redirectIfNotMod } from '~/utils/loaders';
import type { ApiError } from '~/utils/request-helpers';
import {
  create400Json,
  createSuccessJson,
  makeDbErr,
  processApiError,
} from '~/utils/request-helpers';
import { recalculatePublishingQueue } from '~/route-funcs/publishing-queue';
import { unstable_defineAction } from '@remix-run/cloudflare';

export const action = unstable_defineAction(async args => {
  const user = await redirectIfNotMod(args);

  const formDataBody = await args.request.formData();
  const formComicId = formDataBody.get('comicId');
  const formPublishDate = formDataBody.get('publishDate');

  if (!formComicId) return create400Json('Missing comicId');
  if (!formPublishDate) return create400Json('Missing publishDate');

  const err = await scheduleComic(
    args.context.cloudflare.env.DB,
    parseInt(formComicId.toString()),
    formPublishDate.toString(),
    user.userId
  );
  if (err) {
    return processApiError('Error in /schedule-comic', err);
  }
  return createSuccessJson();
});

export async function scheduleComic(
  db: D1Database,
  comicId: number,
  publishDate: string,
  modId: number
): Promise<ApiError | undefined> {
  const metadataQuery =
    'UPDATE comicmetadata SET publishDate = ?, scheduleModId = ?, publishingQueuePos = NULL WHERE comicId = ?';
  const comicQuery = `UPDATE comic SET publishStatus = 'scheduled' WHERE id = ?`;

  const dbRes = await queryDbMultiple(db, [
    {
      query: comicQuery,
      params: [comicId],
    },
    {
      query: metadataQuery,
      params: [modId, comicId],
    },
  ]);

  const logCtx = { comicId, publishDate, modId };

  if (dbRes.isError) {
    return makeDbErr(dbRes, 'Error updating comic+metadata in scheduleComic', logCtx);
  }

  recalculatePublishingQueue(db); // Can run in background
}
