import { addContributionPoints } from '~/route-funcs/add-contribution-points';
import type { UserSession } from '~/types/types';
import { queryDb } from '~/utils/database-facade';
import type { ApiError } from '~/utils/request-helpers';
import { makeDbErr, makeDbErrObj, wrapApiError } from '~/utils/request-helpers';
import type { NewArtist, UploadBody } from './route';

export async function processUpload(
  urlBase: string,
  uploadBody: UploadBody,
  user: UserSession | null,
  userIP?: string
): Promise<ApiError | undefined> {
  const skipApproval = !!user && ['moderator', 'admin'].includes(user?.userType);

  if (uploadBody.newArtist) {
    const { artistId, err } = await createArtist(
      urlBase,
      uploadBody.newArtist,
      skipApproval
    );
    if (err) return wrapApiError(err, 'Error uploading', { uploadBody });
    uploadBody.artistId = artistId;
  }

  const dbRes = await createComic(urlBase, uploadBody, skipApproval);
  if (dbRes.err) return wrapApiError(dbRes.err, 'Error uploading', { uploadBody });
  const comicId = dbRes.comicId;

  const err = await createComicMetadata(
    urlBase,
    comicId,
    uploadBody,
    skipApproval,
    user?.userId,
    userIP
  );
  if (err) return wrapApiError(err, 'Error uploading', { uploadBody });

  if (uploadBody.previousComic || uploadBody.nextComic) {
    const err = await createComicLinks(urlBase, uploadBody, comicId);
    if (err) return wrapApiError(err, 'Error uploading', { uploadBody });
  }

  if (uploadBody.tagIds) {
    const err = await createComicTags(urlBase, uploadBody.tagIds, comicId);
    if (err) return wrapApiError(err, 'Error uploading', { uploadBody });
  }
}

async function createComicTags(
  urlBase: string,
  tagIds: number[],
  comicId: number
): Promise<ApiError | undefined> {
  let query = `
    INSERT INTO comickeyword
    (comicId, keywordId)
    VALUES 
  `;
  const params: number[] = [];

  tagIds.forEach((tagId, index) => {
    query += `(?, ?)`;
    params.push(comicId, tagId);
    if (index < tagIds.length - 1) {
      query += ', ';
    }
  });

  const dbRes = await queryDb(urlBase, query, params);
  if (dbRes.isError) {
    return makeDbErr(dbRes, 'Error creating comic tags');
  }
}

async function createComicLinks(
  urlBase: string,
  uploadBody: UploadBody,
  comicId: number
): Promise<ApiError | undefined> {
  let query = `
    INSERT INTO comiclink
    (firstComic, lastComic)
    VALUES (?, ?)
  `;
  const queryParams: any[] = [];

  if (uploadBody.previousComic) {
    queryParams.push(uploadBody.previousComic.id, comicId);
  }
  if (uploadBody.nextComic) {
    queryParams.push(comicId, uploadBody.nextComic.id);
  }
  if (uploadBody.previousComic && uploadBody.nextComic) {
    query += ', (?, ?)';
  }

  const dbRes = await queryDb(urlBase, query, queryParams);
  if (dbRes.isError) {
    return makeDbErr(dbRes, 'Error creating comic links');
  }
}

async function createComicMetadata(
  urlBase: string,
  comicId: number,
  uploadBody: UploadBody,
  skipApproval: boolean,
  userId?: number,
  userIP?: string
): Promise<ApiError | undefined> {
  const query = `
    INSERT INTO comicmetadata
    (comicId, uploadUserId, uploadUserIP, uploadId, verdict)
    VALUES (?, ?, ?, ?, ?)
  `;

  const values = [
    comicId,
    userId || null,
    userIP || null,
    uploadBody.uploadId,
    skipApproval ? 'excellent' : null,
  ];

  const dbRes = await queryDb(urlBase, query, values);
  if (dbRes.isError) {
    return makeDbErr(dbRes, 'Error creating comic metadata');
  }

  if (skipApproval) {
    const err = await addContributionPoints(
      urlBase,
      userId ?? null,
      `comicUploadexcellent`
    );
    if (err) {
      return wrapApiError(err, 'Error adding contribution points for direct mod upload');
    }
  }
}

async function createComic(
  urlBase: string,
  uploadBody: UploadBody,
  skipApproval: boolean
): Promise<{ comicId: number; err?: undefined } | { err: ApiError }> {
  const query = `
    INSERT INTO comic
    (name, cat, tag, state, numberOfPages, artist, publishStatus)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    uploadBody.comicName.trim(),
    uploadBody.classification,
    uploadBody.category,
    uploadBody.state,
    uploadBody.numberOfPages,
    uploadBody.artistId,
    skipApproval ? 'pending' : 'uploaded',
  ];

  const result = await queryDb(urlBase, query, values);
  if (result.isError) {
    return makeDbErrObj(result, 'Error inserting comic');
  }
  if (!result.insertId) {
    return makeDbErrObj(result, 'Error inserting comic: no insert ID');
  }
  return { comicId: result.insertId };
}

async function createArtist(
  urlBase: string,
  newArtist: NewArtist,
  skipApproval: boolean
): Promise<{ artistId?: number; err?: ApiError | undefined }> {
  const insertQuery = `
    INSERT INTO artist (name, e621name, patreonName, isPending)
    VALUES (?, ?, ?, ?)
  `;
  const insertValues = [
    newArtist.artistName.trim(),
    newArtist.e621Name ? newArtist.e621Name.trim() : null,
    newArtist.patreonName ? newArtist.patreonName.trim() : null,
    skipApproval ? 0 : 1,
  ];
  const dbRes = await queryDb(urlBase, insertQuery, insertValues);
  if (dbRes.isError) {
    return makeDbErrObj(dbRes, 'Error inserting artist');
  }
  const artistId = dbRes.insertId;
  if (!artistId) {
    return makeDbErrObj(dbRes, 'Error inserting artist');
  }

  if (newArtist.links && newArtist.links.length > 0) {
    const err = await createArtistLinks(urlBase, newArtist, artistId);
    if (err) {
      return { err: wrapApiError(err, 'Error creating artist links') };
    }
  }

  return { artistId };
}

async function createArtistLinks(
  urlBase: string,
  newArtist: NewArtist,
  newArtistId: number
): Promise<ApiError | undefined> {
  const filteredLinks = newArtist.links.filter(link => link.length > 0);
  let linkInsertQuery = `INSERT INTO artistlink (ArtistId, LinkUrl) VALUES `;
  const linkInsertValues = [];

  for (let i = 0; i < filteredLinks.length; i++) {
    linkInsertQuery += `(?, ?)`;
    linkInsertValues.push(newArtistId, filteredLinks[i].trim());
    if (i < newArtist.links.length - 1) {
      linkInsertQuery += ', ';
    }
  }

  const dbRes = await queryDb(urlBase, linkInsertQuery, linkInsertValues);
  if (dbRes.isError) {
    return makeDbErr(dbRes, 'Error inserting artist links');
  }
}
