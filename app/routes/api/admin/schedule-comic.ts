import { ActionArgs } from '@remix-run/cloudflare';
import { queryDb } from '~/utils/database-facade';
import { redirectIfNotMod } from '~/utils/loaders';
import {
  ApiError,
  create400Json,
  create500Json,
  createSuccessJson,
  logError,
} from '~/utils/request-helpers';
import { recalculatePublishingQueue } from '../funcs/publishing-queue';

export async function action(args: ActionArgs) {
  const user = await redirectIfNotMod(args);
  const urlBase = args.context.DB_API_URL_BASE as string;

  const formDataBody = await args.request.formData();

  const formComicId = formDataBody.get('comicId');
  const formPublishDate = formDataBody.get('publishDate');

  if (!formComicId) return create400Json('Missing comicId');
  if (!formPublishDate) return create400Json('Missing publishDate');

  const err = await scheduleComic(
    urlBase,
    parseInt(formComicId.toString()),
    formPublishDate.toString(),
    user.userId
  );
  if (err) {
    logError(`Erorr in /schedule-comic for comic id ${formComicId}`, err);
    return create500Json(err.clientMessage);
  }

  return createSuccessJson();
}

export async function scheduleComic(
  urlBase: string,
  comicId: number,
  publishDate: string,
  modId: number
): Promise<ApiError | undefined> {
  const unpublishedQuery =
    'UPDATE unpublishedcomic SET publishDate = ?, scheduleModId = ?, publishingQueuePos = NULL WHERE comicId = ?';
  const comicQuery = `UPDATE comic SET publishStatus = 'scheduled' WHERE id = ?`;

  const [unpublishedDbRes, comicDbRes] = await Promise.all([
    queryDb(urlBase, unpublishedQuery, [publishDate, modId, comicId]),
    queryDb(urlBase, comicQuery, [comicId]),
  ]);

  if (unpublishedDbRes.errorMessage) {
    return {
      clientMessage: 'Error scheduling comic: Could not update unpublishedcomic table',
      logMessage: 'Error scheduling: could not update unpublishedcomic table',
      error: unpublishedDbRes,
    };
  }
  if (comicDbRes.errorMessage) {
    return {
      clientMessage: 'Error scheduling comic: Could not update comic table',
      logMessage: 'Error scheduling: could not update comic table',
      error: comicDbRes,
    };
  }

  recalculatePublishingQueue(urlBase); // Can run in background
}
