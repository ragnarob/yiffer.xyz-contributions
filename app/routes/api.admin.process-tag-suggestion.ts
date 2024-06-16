import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { queryDb, queryDbExec, queryDbMultiple } from '~/utils/database-facade';
import { parseFormJson } from '~/utils/formdata-parser';
import type { ApiError } from '~/utils/request-helpers';
import {
  createSuccessJson,
  makeDbErr,
  processApiError,
  wrapApiError,
} from '~/utils/request-helpers';
import { addContributionPoints } from '~/route-funcs/add-contribution-points';
import type { TagSuggestionItem } from '~/types/types';

export type ProcessTagSuggestionBody = {
  suggestionGroupId: number;
  comicId: number;
  processedItems: TagSuggestionItem[];
  suggestingUserId?: number;
};

export async function action(args: ActionFunctionArgs) {
  const { fields, isUnauthorized, user } = await parseFormJson<ProcessTagSuggestionBody>(
    args,
    'mod'
  );
  if (isUnauthorized) return new Response('Unauthorized', { status: 401 });
  const err = await processTagSuggestion(
    args.context.DB,
    user?.userId as number,
    fields.suggestionGroupId,
    fields.comicId,
    fields.processedItems,
    fields.suggestingUserId
  );

  if (err) {
    return processApiError('Error in /process-tag-suggestion', err, {
      ...fields,
    });
  }
  return createSuccessJson();
}

async function processTagSuggestion(
  db: D1Database,
  modId: number,
  suggestionGroupId: number,
  comicId: number,
  processedItems: TagSuggestionItem[],
  suggestingUserId?: number
): Promise<ApiError | undefined> {
  const updateGroupQuery = `UPDATE tagsuggestiongroup SET isProcessed = ?, modId = ? WHERE id = ?`;
  const updateGroupQueryParams = [1, modId, suggestionGroupId];

  // Fetch all tags to be deleted or added, to see that they're corrently on the comic or present from it
  const getTagsQuery = `SELECT keywordId FROM comickeyword WHERE comicId = ?`;
  const getTagsQueryParams = [comicId];
  const existingTagsQuery = await queryDb<{ keywordId: number }[]>(
    db,
    getTagsQuery,
    getTagsQueryParams
  );
  if (existingTagsQuery.isError) {
    return makeDbErr(
      existingTagsQuery,
      'Error getting existing tags in processTagSuggestion'
    );
  }

  const tagIdsToInsert: number[] = [];
  const tagIdsToDelete: number[] = [];

  for (const item of processedItems) {
    if (!item.isApproved) continue;
    if (item.isAdding) {
      if (existingTagsQuery.result.every(t => t.keywordId !== item.id)) {
        tagIdsToInsert.push(item.id);
      } else {
        // Tag already existed on comic
        item.isApproved = false;
      }
    } else {
      if (existingTagsQuery.result.some(t => t.keywordId === item.id)) {
        tagIdsToDelete.push(item.id);
      } else {
        // Tag was not on comic
        item.isApproved = false;
      }
    }
  }

  // Insert tags
  if (tagIdsToInsert.length > 0) {
    const insertTagsQuery = `INSERT INTO comickeyword (comicId, keywordId) VALUES ${tagIdsToInsert
      .map(() => '(?, ?)')
      .join(', ')}`;
    const insertTagsQueryParams = tagIdsToInsert.flatMap(id => [comicId, id]);
    const insertTagsQueryRes = await queryDb(db, insertTagsQuery, insertTagsQueryParams);
    if (insertTagsQueryRes.isError) {
      return makeDbErr(
        insertTagsQueryRes,
        'Error inserting tags in processTagSuggestion'
      );
    }
  }

  // Delete tags
  if (tagIdsToDelete.length > 0) {
    const deleteTagsQuery = `DELETE FROM comickeyword WHERE comicId = ? AND keywordId IN (${tagIdsToDelete
      .map(() => '?')
      .join(', ')})`;
    const deleteTagsQueryParams = [comicId, ...tagIdsToDelete];
    const deleteTagsQueryRes = await queryDb(db, deleteTagsQuery, deleteTagsQueryParams);
    if (deleteTagsQueryRes.isError) {
      return makeDbErr(deleteTagsQueryRes, 'Error deleting tags in processTagSuggestion');
    }
  }

  // Update tag suggestion items
  const updateItemsQuery = `UPDATE tagsuggestionitem SET isApproved = ? WHERE id = ?`;
  const updateItemsQueryRes = await queryDbMultiple(
    db,
    processedItems.map(item => ({
      query: updateItemsQuery,
      params: [item.isApproved ? 1 : 0, item.tagSuggestionItemId],
    }))
  );
  if (updateItemsQueryRes.isError) {
    return makeDbErr(
      updateItemsQueryRes,
      'Error updating tagsuggestionitem in processTagSuggestion'
    );
  }

  // Update group
  const updateGroupQueryRes = await queryDbExec(
    db,
    updateGroupQuery,
    updateGroupQueryParams
  );
  if (updateGroupQueryRes.isError) {
    return makeDbErr(
      updateGroupQueryRes,
      'Error updating tagsuggestiongroup in processTagSuggestion'
    );
  }

  // Assign points!
  const numberOfApprovedItems = processedItems.filter(item => item.isApproved).length;
  const err = await addContributionPoints(
    db,
    suggestingUserId,
    'tagSuggestion',
    numberOfApprovedItems
  );
  if (err) {
    return wrapApiError(err, 'Error adding contribution points');
  }
}
