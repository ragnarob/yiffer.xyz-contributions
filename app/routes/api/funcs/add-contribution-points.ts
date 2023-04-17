import { format } from 'date-fns';
import { queryDb } from '~/utils/database-facade';
import { ApiError, makeDbErr } from '~/utils/request-helpers';

export async function addContributionPoints(
  urlBase: string,
  userId: number | null,
  pointColumn: string
): Promise<ApiError | undefined> {
  const yearMonth = format(new Date(), 'yyyy-MM');
  const logCtx = { userId, pointColumn, yearMonth };

  const getExistingPointsForMonthQuery = `
    SELECT yearMonth FROM contributionpoints
    WHERE userId = ? AND (yearMonth = ? OR yearMonth = 'all-time')
  `;
  const getExistingPointsForMonthQueryParams = [userId, yearMonth];
  const existingDbRes = await queryDb<{ yearMonth: string }[]>(
    urlBase,
    getExistingPointsForMonthQuery,
    getExistingPointsForMonthQueryParams
  );

  if (existingDbRes.isError) {
    return makeDbErr(existingDbRes, 'Error adding contribution points', logCtx);
  }

  ['all-time', yearMonth].forEach(async timeVal => {
    const existingPoints = existingDbRes.result!.filter(
      entry => entry.yearMonth === timeVal
    );

    if (existingPoints.length === 0) {
      const insertPointsQuery = `
        INSERT INTO contributionpoints (userId, yearMonth, ${pointColumn})
        VALUES (?, ?, 1)
      `;
      const insertPointsQueryParams = [userId, timeVal];
      const insertDbRes = await queryDb(
        urlBase,
        insertPointsQuery,
        insertPointsQueryParams
      );
      if (insertDbRes.isError) {
        return makeDbErr(insertDbRes, 'Error adding contribution points', logCtx);
      }
    } else {
      const updatePointsQuery = `
        UPDATE contributionpoints
        SET ${pointColumn} = ${pointColumn} + 1
        WHERE userId = ? AND yearMonth = ?
      `;
      const updatePointsQueryParams = [userId, timeVal];
      const updateDbRes = await queryDb(
        urlBase,
        updatePointsQuery,
        updatePointsQueryParams
      );
      if (updateDbRes.isError) {
        return makeDbErr(updateDbRes, 'Error updating contribution points', logCtx);
      }
    }
  });
}
