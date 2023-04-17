import { ActionArgs } from '@remix-run/cloudflare';
import { queryDb } from '~/utils/database-facade';
import { parseFormJson } from '~/utils/formdata-parser';
import {
  ApiError,
  createSuccessJson,
  makeDbErr,
  processApiError,
} from '~/utils/request-helpers';
import { DashboardActionType } from './dashboard-data';

export type AssignActionBody = {
  actionId: number;
  actionType: DashboardActionType;
  modId: number;
};

export async function action(args: ActionArgs) {
  const { fields, isUnauthorized } = await parseFormJson<AssignActionBody>(args, 'mod');
  if (isUnauthorized) return new Response('Unauthorized', { status: 401 });
  const urlBase = args.context.DB_API_URL_BASE as string;

  const err = await assignActionToMod(
    urlBase,
    fields.actionId,
    fields.actionType,
    fields.modId
  );
  if (err) return processApiError('Error in /assign-action', err);
  return createSuccessJson();
}

async function assignActionToMod(
  urlBase: string,
  actionId: number,
  actionType: DashboardActionType,
  modId: number
): Promise<ApiError | undefined> {
  let table = '';
  let identifyingColumn = 'id';
  let modIdColumn = 'modId';

  if (actionType === 'comicUpload') {
    table = 'comicmetadata';
    identifyingColumn = 'comicId';
  }
  if (actionType === 'comicSuggestion') {
    table = 'comicsuggestion';
  }
  if (actionType === 'comicProblem') {
    table = 'comicproblem';
  }
  if (actionType === 'pendingComicProblem') {
    table = 'comicmetadata';
    identifyingColumn = 'comicId';
    modIdColumn = 'pendingProblemModId';
  }

  const query = `UPDATE ${table} SET ${modIdColumn} = ? WHERE ${identifyingColumn} = ?`;
  const queryParams = [modId, actionId];

  const dbRes = await queryDb(urlBase, query, queryParams);
  if (dbRes.isError) {
    return makeDbErr(dbRes, 'Error assigning action to mod', {
      actionId,
      actionType,
      modId,
    });
  }
}
