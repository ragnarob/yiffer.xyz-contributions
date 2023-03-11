import { ActionArgs } from '@remix-run/cloudflare';
import { queryDbDirect } from '~/utils/database-facade';
import { redirectIfNotMod } from '~/utils/loaders';
import {
  create400Json,
  create500Json,
  createGeneric500Json,
  createSuccessJson,
} from '~/utils/request-helpers';

export async function action(args: ActionArgs) {
  await redirectIfNotMod(args);
  const urlBase = args.context.DB_API_URL_BASE as string;

  const formDataBody = await args.request.formData();

  const formComicId = formDataBody.get('comicId');
  if (!formComicId) return create400Json('Missing comicId');

  try {
    await unlistComic(urlBase, parseInt(formComicId.toString()));
  } catch (e) {
    return e instanceof Error ? create500Json(e.message) : createGeneric500Json();
  }

  return createSuccessJson();
}

export async function unlistComic(urlBase: string, comicId: number) {
  const comicQuery = `UPDATE comic SET publishStatus = 'published' WHERE id = ?`;
  const unpublishedQuery =
    'UPDATE unpublishedcomic SET unlistComment = NULL WHERE comicId = ?';

  await Promise.all([
    queryDbDirect(urlBase, comicQuery, [comicId]),
    queryDbDirect(urlBase, unpublishedQuery, [comicId]),
  ]);
}
