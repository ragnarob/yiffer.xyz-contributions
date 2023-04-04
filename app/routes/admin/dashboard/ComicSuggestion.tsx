import { Form } from '@remix-run/react';
import { useState } from 'react';
import { IoCaretDown, IoCaretUp } from 'react-icons/io5';
import Button from '~/components/Buttons/Button';
import DropdownButton from '~/components/Buttons/DropdownButton';
import LoadingButton from '~/components/Buttons/LoadingButton';
import Chip from '~/components/Chip';
import TextInput from '~/components/TextInput/TextInput';
import { DashboardAction } from '~/routes/api/admin/dashboard-data';
import { ComicSuggestionVerdict } from '~/types/types';
import { getTimeAgo } from '.';

type ComicSuggestionProps = {
  action: DashboardAction;
  isLoading: boolean;
  onAssignMe: (action: DashboardAction) => void;
  onUnassignMe: (action: DashboardAction) => void;
  onProcessed: (
    action: DashboardAction,
    isApproved: boolean,
    verdict?: ComicSuggestionVerdict,
    modComment?: string
  ) => void;
  loadingAction?: string;
  isAssignedToOther?: boolean;
  isAssignedToMe?: boolean;
  innerContainerClassName: string;
};

export function ComicSuggestion({
  action,
  isLoading,
  onAssignMe,
  onUnassignMe,
  onProcessed,
  loadingAction,
  isAssignedToOther,
  isAssignedToMe,
  innerContainerClassName,
}: ComicSuggestionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRejectingWithComment, setIsRejectingWithComment] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  const isChooseActionButtonLoading =
    isLoading &&
    !!loadingAction &&
    ['unassign', 'process-upload'].includes(loadingAction);

  function onInitiateRejectComment() {
    if (!isOpen) setIsOpen(true);
    setIsRejectingWithComment(true);
    setRejectComment('');
  }

  function finishRejectWithComment() {
    onProcessed(action, false, undefined, rejectComment);
  }

  // Close after submission
  if (loadingAction === 'process-upload' && !isLoading && isRejectingWithComment) {
    setIsRejectingWithComment(false);
  }

  return (
    <div
      className="flex flex-col w-full gap-2 cursor-pointer"
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className={innerContainerClassName}>
        <div className="flex flex-col justify-between gap-2">
          <Chip color="#c54b8d" text="Comic suggestion" />
          <div className="flex flex-col md:flex-row gap-x-12 gap-y-1">
            <p>
              <b>{action.primaryField}</b>
            </p>
            <p>{action.secondaryField}</p>
          </div>
        </div>

        <div className="flex flex-col md:items-end justify-between gap-2 flex-shrink-0">
          <p className="text-sm">
            {action.user.username || action.user.ip}
            {' - '}
            {getTimeAgo(action.timestamp)}
          </p>

          {action.isProcessed && (
            <p>
              <i>Completed by: {action.assignedMod?.username}</i>
            </p>
          )}
          {isAssignedToOther && (
            <p>
              <i>Assigned to: {action.assignedMod!.username}</i>
            </p>
          )}

          <div className="flex flex-row gap-2 self-end">
            {isAssignedToMe && (
              <DropdownButton
                text="Choose action"
                color="primary"
                isLoading={isChooseActionButtonLoading}
                options={[
                  {
                    text: 'Unassign from me',
                    onClick: () => onUnassignMe(action),
                  },
                  {
                    text: 'Reject with comment',
                    onClick: onInitiateRejectComment,
                  },
                  {
                    text: 'Reject as spam/dupl.',
                    onClick: () => onProcessed(action, false),
                  },
                  {
                    text: 'Completed - excellent info',
                    onClick: () => onProcessed(action, true, 'good'),
                  },
                  {
                    text: 'Completed - lacking info',
                    onClick: () => onProcessed(action, true, 'bad'),
                  },
                ]}
              />
            )}
            {!action.isProcessed && !action.assignedMod && (
              <LoadingButton
                color="primary"
                onClick={e => {
                  e.stopPropagation();
                  onAssignMe(action);
                }}
                text="I'm on it"
                isLoading={isLoading && loadingAction === 'assign'}
              />
            )}
          </div>
        </div>
      </div>

      {isOpen ? (
        <>
          <p
            className="whitespace-pre-wrap cursor-auto"
            onClick={e => e.stopPropagation()}
          >
            {action.description}
          </p>

          {isRejectingWithComment && (
            <div className="mt-4 mb-2 cursor-auto" onClick={e => e.stopPropagation()}>
              <p>
                <b>Reject with comment</b>
              </p>
              <p>
                This comment will be visible to the user. Keep it short and grammatically
                correct!
              </p>
              <Form>
                <TextInput
                  value={rejectComment}
                  onChange={setRejectComment}
                  placeholder={`E.g. "quality too low" or "paywalled content"`}
                  label="Comment"
                  name="comment"
                  className="mt-2 mb-2"
                />
                <div className="flex flex-row flex-wrap gap-2">
                  <LoadingButton
                    color="primary"
                    onClick={finishRejectWithComment}
                    disabled={!rejectComment}
                    text="Reject suggestion"
                    isSubmit
                    isLoading={isLoading && loadingAction === 'process-upload'}
                  />
                  <Button
                    color="error"
                    variant="outlined"
                    onClick={() => setIsRejectingWithComment(false)}
                    text="Cancel"
                  />
                </div>
              </Form>
            </div>
          )}

          {action.isProcessed && (
            <p>
              <b>Verdict: {action.verdict}</b>
            </p>
          )}

          <IoCaretUp className="mx-auto -mb-1 text-blue-weak-200 dark:text-text-dark" />
        </>
      ) : (
        <IoCaretDown className="mx-auto -mb-1 text-blue-weak-200 dark:text-text-dark" />
      )}
    </div>
  );
}
