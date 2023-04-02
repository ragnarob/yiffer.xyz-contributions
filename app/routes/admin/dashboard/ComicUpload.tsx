import { MdOpenInNew } from 'react-icons/md';
import LoadingButton from '~/components/Buttons/LoadingButton';
import Chip from '~/components/Chip';
import Link from '~/components/Link';
import { DashboardAction } from '~/routes/api/admin/dashboard-data';
import { getTimeAgo } from '.';

type ComicUploadProps = {
  action: DashboardAction;
  isLoading: boolean;
  onAssignMe: (action: DashboardAction) => void;
  onUnassignMe: (action: DashboardAction) => void;
  loadingAction?: string;
  isAssignedToOther?: boolean;
  isAssignedToMe?: boolean;
};

export function ComicUpload({
  action,
  isLoading,
  onAssignMe,
  onUnassignMe,
  loadingAction,
  isAssignedToOther,
  isAssignedToMe,
}: ComicUploadProps) {
  return (
    <>
      <div className="flex flex-col justify-between gap-2">
        <Chip color="#c54b8d" text="Comic upload" />
        <div className="flex flex-col md:flex-row gap-x-12 gap-y-1">
          <div className="flex flex-row gap-x-3">
            <Link
              href={`/admin/comics/${action.comicId}`}
              text={action.primaryField}
              IconRight={MdOpenInNew}
              newTab
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col md:items-end justify-between gap-2 flex-shrink-0">
        <p className="text-sm ">
          {action.user.username || action.user.ip}
          {' - '}
          {getTimeAgo(action.timestamp)}
        </p>

        <div className="flex flex-row gap-2 self-end">
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
          {isAssignedToMe && (
            <LoadingButton
              color="error"
              onClick={() => onUnassignMe(action)}
              text="Unassign from me"
              isLoading={isLoading && loadingAction === 'unassign'}
            />
          )}
          {!action.isProcessed && !action.assignedMod && (
            <LoadingButton
              color="primary"
              onClick={() => onAssignMe(action)}
              text="I'm on it"
              isLoading={isLoading && loadingAction === 'assign'}
            />
          )}
        </div>
      </div>
    </>
  );
}
