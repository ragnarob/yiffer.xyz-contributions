import { queryDb } from '~/utils/database-facade';
import { ApiError } from '~/utils/request-helpers';

type ComicInQueue = {
  publishingQueuePos: number;
  comicId: number;
};

export async function moveComicInQueue(
  urlBase: string,
  comicId: number,
  moveBy: 1 | -1
): Promise<ApiError | undefined> {
  const getPosQuery = 'SELECT publishingQueuePos FROM comicmetadata WHERE comicId = ?';
  const positionDbRes = await queryDb<{ publishingQueuePos: number }[]>(
    urlBase,
    getPosQuery,
    [comicId]
  );

  if (positionDbRes.errorMessage || !positionDbRes.result) {
    return {
      client400Message: 'Error moving comic in publishing queue',
      logMessage: `Error moving comic with id ${comicId} in publishing queue, move by ${moveBy}.`,
      error: positionDbRes,
    };
  }

  const oldPos = positionDbRes.result[0].publishingQueuePos;

  const moveComicQuery =
    'UPDATE comicmetadata SET publishingQueuePos = ? WHERE comicId = ?';
  const moveComicQueryParams = [oldPos + moveBy, comicId];

  const moveOtherComicQuery =
    'UPDATE comicmetadata SET publishingQueuePos = ? WHERE publishingQueuePos = ?';
  const moveOtherComicQueryParams = [oldPos, oldPos + moveBy];

  const moveOtherDbRes = await queryDb(
    urlBase,
    moveOtherComicQuery,
    moveOtherComicQueryParams
  );
  if (moveOtherDbRes.errorMessage) {
    return {
      client400Message: 'Error moving comic in publishing queue',
      logMessage: `Error moving comic in publishing queue, first one. Comic id ${comicId}, moving: ${moveBy}`,
      error: moveOtherDbRes,
    };
  }

  const moveComicDbRes = await queryDb(urlBase, moveComicQuery, moveComicQueryParams);
  if (moveComicDbRes.errorMessage) {
    return {
      client400Message: 'Error moving comic in publishing queue',
      logMessage: `Error moving comic in publishing queue, second one. Comic id ${comicId}, moving: ${moveBy}`,
      error: moveComicDbRes,
    };
  }
}

export async function recalculatePublishingQueue(
  urlBase: string
): Promise<ApiError | undefined> {
  const query = `
    SELECT publishingQueuePos, comicId
    FROM comicmetadata INNER JOIN comic ON (comic.id = comicmetadata.comicId)
    WHERE
      publishStatus = 'scheduled'
      AND publishDate IS NULL
    ORDER BY publishingQueuePos ASC
  `;

  const queueDbRes = await queryDb<ComicInQueue[]>(urlBase, query);
  if (queueDbRes.errorMessage) {
    return {
      client400Message: 'Error getting comics in queue',
      logMessage: 'Error getting comics in queue',
      error: queueDbRes,
    };
  }

  let queue = queueDbRes.result as ComicInQueue[];
  const comicsWithPos = queue.filter(comic => comic.publishingQueuePos !== null);
  const comicsWithoutPos = queue.filter(comic => comic.publishingQueuePos === null);

  const newQueue = comicsWithPos
    .sort((a, b) => a.publishingQueuePos - b.publishingQueuePos)
    .map((comic, index) => {
      return {
        ...comic,
        publishingQueuePos: index + 1,
      };
    })
    .concat(
      comicsWithoutPos.map((comic, index) => {
        return {
          ...comic,
          publishingQueuePos: comicsWithPos.length + index + 1,
        };
      })
    );

  // only update comics whose position changed
  const comicsToUpdate = [];
  for (const comic of queue) {
    const newQueuePos = newQueue.find(
      newComic => newComic.comicId === comic.comicId
    )?.publishingQueuePos;
    if (newQueuePos !== comic.publishingQueuePos) {
      comicsToUpdate.push({
        comicId: comic.comicId,
        newQueuePos,
      });
    }
  }

  const updateQuery = `
    UPDATE comicmetadata
    SET publishingQueuePos = ?
    WHERE comicId = ?
  `;

  const updatePromises = comicsToUpdate.map(comic =>
    queryDb(urlBase, updateQuery, [comic.newQueuePos, comic.comicId])
  );

  const updateDbRes = await Promise.all(updatePromises);
  for (const result of updateDbRes) {
    if (result.errorMessage) {
      return {
        client400Message: 'Error updating queue position of pending comic',
        logMessage: 'Error updating queue position of pending comic',
        error: queueDbRes,
      };
    }
  }
}
