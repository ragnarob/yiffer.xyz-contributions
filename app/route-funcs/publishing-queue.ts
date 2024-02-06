import type { DBInputWithErrMsg } from '~/utils/database-facade';
import { queryDb, queryDbExec, queryDbMultiple } from '~/utils/database-facade';
import type { ApiError } from '~/utils/request-helpers';
import { makeDbErr } from '~/utils/request-helpers';

type ComicInQueue = {
  publishingQueuePos: number;
  comicId: number;
};

export async function moveComicInQueue(
  db: D1Database,
  comicId: number,
  moveBy: 1 | -1
): Promise<ApiError | undefined> {
  const logCtx = { comicId, moveBy };
  const getPosQuery = 'SELECT publishingQueuePos FROM comicmetadata WHERE comicId = ?';
  const positionDbRes = await queryDb<{ publishingQueuePos: number }[]>(db, getPosQuery, [
    comicId,
  ]);

  if (positionDbRes.isError || !positionDbRes.result) {
    return makeDbErr(positionDbRes, 'Error moving comic in publishing queue', logCtx);
  }

  const oldPos = positionDbRes.result[0].publishingQueuePos;

  const moveComicQuery =
    'UPDATE comicmetadata SET publishingQueuePos = ? WHERE comicId = ?';
  const moveComicQueryParams = [oldPos + moveBy, comicId];

  const moveOtherComicQuery =
    'UPDATE comicmetadata SET publishingQueuePos = ? WHERE publishingQueuePos = ?';
  const moveOtherComicQueryParams = [oldPos, oldPos + moveBy];

  const moveOtherDbRes = await queryDbExec(
    db,
    moveOtherComicQuery,
    moveOtherComicQueryParams
  );
  if (moveOtherDbRes.isError) {
    return makeDbErr(
      moveOtherDbRes,
      'Error moving other comic in publishing queue',
      logCtx
    );
  }

  const moveComicDbRes = await queryDbExec(db, moveComicQuery, moveComicQueryParams);
  if (moveComicDbRes.isError) {
    return makeDbErr(
      moveComicDbRes,
      'Error moving this comic in publishing queue',
      logCtx
    );
  }
}

export async function recalculatePublishingQueue(
  db: D1Database
): Promise<ApiError | undefined> {
  const query = `
    SELECT publishingQueuePos, comicId
    FROM comicmetadata INNER JOIN comic ON (comic.id = comicmetadata.comicId)
    WHERE
      publishStatus = 'scheduled'
      AND publishDate IS NULL
    ORDER BY publishingQueuePos ASC
  `;

  const queueDbRes = await queryDb<ComicInQueue[]>(db, query);
  if (queueDbRes.isError) {
    return makeDbErr(queueDbRes, 'Error getting comics in queue');
  }

  const queue = queueDbRes.result as ComicInQueue[];
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
    const newQueuePos = newQueue.find(newComic => newComic.comicId === comic.comicId)
      ?.publishingQueuePos;
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

  const updateStatements: DBInputWithErrMsg[] = comicsToUpdate.map(comic => ({
    query: updateQuery,
    params: [comic.newQueuePos, comic.comicId],
    errorLogMessage: `Error updating queue position of pending comic, id ${comic.comicId}`,
  }));

  const dbRes = await queryDbMultiple(
    db,
    updateStatements,
    'Error updating comics in recalculatePublishingQueue'
  );

  if (dbRes.isError) {
    return makeDbErr(dbRes, dbRes.errorMessage);
  }
}
