import { ActionArgs } from '@remix-run/cloudflare';
import { queryDb } from '~/utils/database-facade';
import { parseFormJson } from '~/utils/formdata-parser';
import {
  ApiError,
  createSuccessJson,
  makeDbErr,
  processApiError,
} from '~/utils/request-helpers';
import { addContributionPoints } from '../funcs/add-contribution-points';

export type ProcessComicProblemBody = {
  actionId: number;
  isApproved: boolean;
  reportingUserId?: number;
};

export async function action(args: ActionArgs) {
  const { fields, isUnauthorized, user } = await parseFormJson<ProcessComicProblemBody>(
    args,
    'mod'
  );
  if (isUnauthorized) return new Response('Unauthorized', { status: 401 });
  const urlBase = args.context.DB_API_URL_BASE as string;

  const err = await processComicProblem(
    urlBase,
    fields.isApproved,
    fields.actionId,
    user!.userId,
    fields.reportingUserId
  );

  if (err)
    return processApiError('Error in /process-comic-problem', err, {
      ...fields,
    });

  return createSuccessJson();
}

async function processComicProblem(
  urlBase: string,
  isApproved: boolean,
  actionId: number,
  modId: number,
  reportingUserId?: number
): Promise<ApiError | undefined> {
  const updateActionQuery = `UPDATE comicproblem SET status = ?, modId = ? WHERE id = ?`;
  const updateActionQueryParams = [isApproved ? 'approved' : 'rejected', modId, actionId];

  const dbRes = await queryDb(urlBase, updateActionQuery, updateActionQueryParams);
  if (dbRes.isError) {
    return makeDbErr(dbRes, 'Error updating comic problem');
  }

  const err = await addContributionPoints(
    urlBase,
    reportingUserId ?? null,
    isApproved ? 'comicProblem' : 'comicProblemRejected'
  );
  if (err) return err;
}
