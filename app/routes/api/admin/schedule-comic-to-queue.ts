import { ActionArgs } from '@remix-run/cloudflare';
import { queryDbDirect } from '~/utils/database-facade';
import { redirectIfNotMod } from '~/utils/loaders';
import {
  create400Json,
  create500Json,
  createGeneric500Json,
  createSuccessJson,
} from '~/utils/request-helpers';
import { recalculatePublishingQueue } from '../funcs/publishing-queue';

export async function action(args: ActionArgs) {
  const user = await redirectIfNotMod(args);
  const urlBase = args.context.DB_API_URL_BASE as string;

  const formDataBody = await args.request.formData();
  const formComicId = formDataBody.get('comicId');
  if (!formComicId) return create400Json('Missing comicId');

  try {
    await scheduleComic(urlBase, parseInt(formComicId.toString()), user.userId);
  } catch (e) {
    return e instanceof Error ? create500Json(e.message) : createGeneric500Json();
  }

  return createSuccessJson();
}

export async function scheduleComic(urlBase: string, comicId: number, modId: number) {
  const unpublishedQuery =
    'UPDATE unpublishedcomic SET scheduleModId = ? WHERE comicId = ?';
  const comicQuery = `UPDATE comic SET publishStatus = 'scheduled' WHERE id = ?`;

  await Promise.all([
    queryDbDirect(urlBase, unpublishedQuery, [modId, comicId]),
    queryDbDirect(urlBase, comicQuery, [comicId]),
  ]);

  await recalculatePublishingQueue(urlBase);
}
