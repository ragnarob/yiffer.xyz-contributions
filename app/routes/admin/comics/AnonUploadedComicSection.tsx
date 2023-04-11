import { useState } from 'react';
import { Comic } from '~/types/types';
import LoadingButton from '~/components/Buttons/LoadingButton';
import { format } from 'date-fns';
import RadioButtonGroup from '~/components/RadioButton/RadioButtonGroup';
import InfoBox from '~/components/InfoBox';
import { useGoodFetcher } from '~/utils/useGoodFetcher';

type AnonUploadSectionProps = {
  comicData: Comic;
  updateComic: () => void;
};

export type AllowedAnonComicVerdict = 'approved' | 'rejected' | 'rejected-list';

export default function AnonUploadSection({
  comicData,
  updateComic,
}: AnonUploadSectionProps) {
  const fetcher = useGoodFetcher({
    url: '/api/admin/process-anon-upload',
    method: 'post',
    toastSuccessMessage: 'Comic processed',
    onFinish: updateComic,
  });
  const [verdict, setVerdict] = useState<AllowedAnonComicVerdict | undefined>();

  function processComic() {
    if (!verdict) return;

    const body = {
      comicId: comicData.id.toString(),
      comicName: comicData.name,
      verdict: verdict,
    };
    fetcher.submit(body);
  }

  return (
    <>
      <p className="mt-2">
        This comic is not live. It has been uploaded by a user and is now up for mod
        review.
      </p>
      <p>
        You should <b>fix errors</b> before approving. If the quality of the uploaded
        content is not good enough, you should <b>reject it</b>.
      </p>
      <p>Uploaded by a guest user with IP {comicData.metadata?.uploadUserIP}.</p>
      <p>Uploaded {format(new Date(comicData.metadata?.timestamp || ''), 'PPPPp')}</p>

      <RadioButtonGroup
        onChange={val => setVerdict(val as AllowedAnonComicVerdict)}
        value={verdict}
        name="verdict"
        className="mt-4"
        options={[
          { value: 'approved', text: 'Approve submission - set comic pending' },
          {
            value: 'rejected-list',
            text: 'Reject submission due to the nature of the comic - add to ban list (click to read more)',
          },
          {
            value: 'rejected',
            text: 'Reject submission due to poorly provided info in the submission (click to read more)',
          },
        ]}
      />

      {(verdict === 'rejected' || verdict === 'rejected-list') && (
        <InfoBox
          variant="info"
          title="Rejecting"
          showIcon
          className="mt-4 max-w-4xl"
          boldText={false}
          disableElevation
        >
          <p className="mt-2">
            If the comic should not be on Yiffer.xyz at all - for example if the art
            quality is too bad, if it's a cub comic, if it's not in English, or if it's
            got censoring bars (etc.) - use the upper of the two reject options. This will
            add the comic's name to a <u>ban list</u>, preventing others from uploading
            it. It is therefore important that you <u>fix the name</u> in case it's
            misspelled. If choosing this, you should absolutely leave a brief comment
            explaining why.
          </p>
          <p className="mt-4">
            If the comic could be on Yiffer.xyz but the quality upload is garbage, use the
            lower of the two options. Use this one if it's spam/trolling as well.
          </p>
        </InfoBox>
      )}

      <LoadingButton
        text="Submit"
        className="mt-4"
        isLoading={fetcher.isLoading}
        disabled={!verdict}
        onClick={processComic}
      />
    </>
  );
}
