import { ActionArgs } from '@remix-run/cloudflare';
import { ArtistDataChanges } from '~/routes/admin/artists/$artist';
import { Artist } from '~/types/types';
import { DBResponse, queryDb } from '~/utils/database-facade';
import { redirectIfNotMod } from '~/utils/loaders';
import {
  ApiError,
  create500Json,
  createSuccessJson,
  wrapApiError,
} from '~/utils/request-helpers';
import { getArtistById } from '../funcs/get-artist';

export async function action(args: ActionArgs) {
  const urlBase = args.context.DB_API_URL_BASE as string;
  await redirectIfNotMod(args);
  const formData = await args.request.formData();
  const body = JSON.parse(formData.get('body') as string) as ArtistDataChanges;

  const err = await updateArtistData(urlBase, body);
  if (err) {
    return create500Json(err.clientMessage);
  }

  return createSuccessJson();
}

export async function updateArtistData(
  urlBase: string,
  changes: ArtistDataChanges
): Promise<ApiError | undefined> {
  let promises: Promise<ApiError | undefined>[] = [];

  if (
    changes.name ||
    changes.e621Name !== undefined ||
    changes.patreonName !== undefined
  ) {
    promises.push(updateGeneralDetails(urlBase, changes));
  }
  if (changes.links) {
    const { artist, err: artistErr } = await getArtistById(urlBase, changes.artistId);
    if (artistErr) {
      return wrapApiError(artistErr, `Error updating artist, changes: ${changes}`);
    }
    promises.push(
      updateLinks(urlBase, changes.artistId, changes.links, artist as Artist)
    );
  }

  const maybeErrors = await Promise.all(promises);
  for (const err of maybeErrors) {
    if (err) {
      return wrapApiError(err, `Error updating artist data, changes: ${changes}`);
    }
  }
}

async function updateLinks(
  urlBase: string,
  artistId: number,
  links: string[],
  existingArtist: Artist
): Promise<ApiError | undefined> {
  const newLinks = links.filter(l => !existingArtist.links.includes(l));
  const deletedLinks = existingArtist.links.filter(l => !links.includes(l));

  const dbPromises: Promise<DBResponse<any>>[] = [];
  const logStrings: string[] = [];

  if (newLinks.length > 0) {
    const addLinksQuery = `INSERT INTO artistlink (artistId, linkUrl) VALUES ${newLinks
      .map(() => '(?, ?)')
      .join(', ')}`;
    dbPromises.push(
      queryDb(
        urlBase,
        addLinksQuery,
        newLinks.flatMap(l => [artistId, l])
      )
    );
    logStrings.push(`insert links: ${newLinks}`);
  }
  if (deletedLinks.length > 0) {
    const deleteLinksQuery = `DELETE FROM artistlink WHERE artistId = ? AND linkUrl IN (${deletedLinks
      .map(() => '?')
      .join(', ')})`;
    dbPromises.push(queryDb<any>(urlBase, deleteLinksQuery, [artistId, ...deletedLinks]));
    logStrings.push(`delete links: ${deletedLinks}`);
  }

  const dbResponses = await Promise.all(dbPromises);
  for (let i = 0; i < dbResponses.length; i++) {
    if (dbResponses[i].errorMessage) {
      return {
        clientMessage: 'Error updating artist links',
        logMessage: `Error updating artist links - ${logStrings[i]}`,
        error: dbResponses[i],
      };
    }
  }
}

async function updateGeneralDetails(
  urlBase: string,
  changes: ArtistDataChanges
): Promise<ApiError | undefined> {
  let updateFieldStr = '';
  let updateFieldValues: any[] = [];
  if (changes.name) {
    updateFieldStr += 'name = ?, ';
    updateFieldValues.push(changes.name);
  }
  if (changes.e621Name !== undefined) {
    updateFieldStr += 'e621Name = ?, ';
    updateFieldValues.push(changes.e621Name);
  }
  if (changes.patreonName !== undefined) {
    updateFieldStr += 'patreonName = ?, ';
    updateFieldValues.push(changes.patreonName);
  }

  updateFieldStr = updateFieldStr.slice(0, -2);
  updateFieldValues.push(changes.artistId);

  const updateQuery = `UPDATE artist SET ${updateFieldStr} WHERE id = ?`;
  const dbRes = await queryDb(urlBase, updateQuery, updateFieldValues);
  if (dbRes.errorMessage) {
    return {
      clientMessage: 'Error updating artist details',
      logMessage: 'Error updating artist details',
    };
  }
}