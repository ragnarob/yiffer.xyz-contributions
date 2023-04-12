import { ActionArgs, LoaderArgs } from '@remix-run/cloudflare';
import { useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import LoadingButton from '~/components/Buttons/LoadingButton';
import InfoBox from '~/components/InfoBox';
import { getAllArtists } from '~/routes/api/funcs/get-artists';
import { getAllComicNamesAndIDs } from '~/routes/api/funcs/get-comics';
import { getAllTags } from '~/routes/api/funcs/get-tags';
import { ComicTiny, Tag } from '~/types/types';
import { authLoader } from '~/utils/loaders';
import BackToContribute from '../BackToContribute';
import Step1 from './step1';
import ComicDataEditor from '../../../components/ComicManager/ComicData';
import Step3Pagemanager from './step3-pagemanager';
import Step4Thumbnail from './step4-thumbnail';
import TagsEditor from '../../../components/ComicManager/Tags';
import SuccessMessage from './success';
import { processUpload } from './upload-handler.server';
import {
  create400Json,
  create500Json,
  createSuccessJson,
  logApiError,
  processApiError,
} from '~/utils/request-helpers';
import { useGoodFetcher } from '~/utils/useGoodFetcher';
const illegalComicNameChars = ['#', '/', '?', '\\'];
const maxUploadBodySize = 80 * 1024 * 1024; // 80 MB

export async function loader(args: LoaderArgs) {
  const urlBase = args.context.DB_API_URL_BASE as string;

  const allArtistsPromise = getAllArtists(urlBase, {
    includePending: true,
    modifyNameIncludeType: true,
  });
  const comicsPromise = getAllComicNamesAndIDs(urlBase, { modifyNameIncludeType: true });
  const tagsPromise = getAllTags(urlBase);
  const userPromise = authLoader(args);
  const [artistsRes, comicsRes, tagsRes, user] = await Promise.all([
    allArtistsPromise,
    comicsPromise,
    tagsPromise,
    userPromise,
  ]);
  if (artistsRes.err || !artistsRes.artists) {
    return processApiError(
      'Error getting artists in upload',
      artistsRes.err || { logMessage: 'Artists returned as undefined' }
    );
  }
  if (comicsRes.err || !comicsRes.comics) {
    return processApiError(
      'Error getting comics in upload',
      comicsRes.err || { logMessage: 'Comics returned as undefined' }
    );
  }
  if (tagsRes.err || !tagsRes.tags) {
    return processApiError(
      'Error getting tags in upload',
      tagsRes.err || { logMessage: 'Tags returned as undefined' }
    );
  }

  return {
    artists: artistsRes.artists,
    comics: comicsRes.comics,
    tags: tagsRes.tags,
    user,
    uploadUrlBase: args.context.DB_API_URL_BASE as string,
  };
}

export async function action(args: ActionArgs) {
  const user = await authLoader(args);
  const formData = await args.request.formData();
  const body = JSON.parse(formData.get('body') as string) as UploadBody;
  const { error } = validateUploadForm(body);
  if (error) return create400Json(error);

  const err = await processUpload(
    args.context.DB_API_URL_BASE as string,
    body,
    user,
    args.request.headers.get('CF-Connecting-IP') || 'unknown'
  );
  if (err) {
    logApiError('Error in upload comic submit', err, body);
    return create500Json();
  }
  return createSuccessJson();
}

export default function Upload() {
  const { artists, comics, uploadUrlBase, user, tags } = useLoaderData<typeof loader>();
  const [step, setStep] = useState<number | string>(1);
  const [comicData, setComicData] = useState<NewComicData>(createEmptyUploadData());
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitFetcher = useGoodFetcher({
    method: 'post',
    encType: 'multipart/form-data',
    toastError: false,
    onFinish: () => {
      setIsSubmitting(false);
      if (submitFetcher.success) setStep('success');
      if (submitFetcher.isError) setError(submitFetcher.errorMessage);
    },
  });

  async function submit() {
    const randomId = generateRandomId();
    const uploadId = `${comicData.comicName}-${randomId}`;
    setError(null);

    if (!comicData.validation.isLegalComicName) {
      setError('There is an error regarding the comic name');
      return;
    }

    if (comicData.newArtist.artistName) {
      const isNameIllegal = !comicData.artistId && !comicData.newArtist.isValidName;
      const isE621Illegal =
        !comicData.newArtist.e621Name && !comicData.newArtist.hasConfirmedNoE621Name;
      const isPatreonIllegal =
        !comicData.newArtist.patreonName &&
        !comicData.newArtist.hasConfirmedNoPatreonName;

      if (isNameIllegal) {
        setError('There is an error regarding the artist name');
        return;
      }
      if (isE621Illegal) {
        setError('You must confirm that the artist does not have an e621 name');
        return;
      }
      if (isPatreonIllegal) {
        setError('You must confirm that the artist does not have a patreon name');
        return;
      }
    }

    let newArtist: NewArtist | undefined;
    if (comicData.newArtist.artistName) {
      newArtist = {
        ...comicData.newArtist,
        links: comicData.newArtist.links.filter(link => link.length > 0),
      };
    }

    const uploadBody: UploadBody = {
      uploadId,
      comicName: comicData.comicName,
      category: comicData.category,
      classification: comicData.classification,
      state: comicData.state,
      tagIds: comicData.tags.map(tag => tag.id),
      newArtist: newArtist,
      artistId: comicData.artistId,
      numberOfPages: comicData.files.length - 1,
      previousComic: comicData.previousComic?.id ? comicData.previousComic : undefined,
      nextComic: comicData.nextComic?.id ? comicData.nextComic : undefined,
    };

    const formData = new FormData();
    formData.append('body', JSON.stringify(uploadBody));

    // TODO: only temporary to make stuff work, until we implement thumbnail thing
    comicData.thumbnailFile = comicData.files[0];

    const { error } = validateUploadForm(uploadBody);
    if (error) {
      setError(error);
      return;
    }
    if (comicData.files.length < 3 || !comicData.thumbnailFile) {
      setError('You need at least 3 pages and a thumbnail');
      return;
    }

    setIsSubmitting(true);
    // First, upload files, split. Do this directly to the old api,
    // because CF workers might have stricter limits than the old api
    // and there is no need to go through that for this - old API
    // deals with all validation and handling regardless.
    const { error: uploadError } = await uploadFiles(comicData, uploadId, uploadUrlBase);
    if (uploadError) {
      setError(uploadError);
      setIsSubmitting(false);
      return;
    }

    submitFetcher.submit(formData);
  }

  return (
    <div className="container mx-auto pb-16">
      <h1>Upload a comic</h1>
      <p className="mb-4">
        <BackToContribute />
      </p>

      {user?.userType === 'moderator' && (
        <InfoBox variant="info" showIcon className="mb-4">
          You're logged in as a mod. Your comic (and artist, if it's a new one) will
          therefore skip the regular user upload queue and go straight to 'pending'.
        </InfoBox>
      )}

      {step === 'success' && <SuccessMessage isLoggedIn={!!user} />}

      {step === 1 && <Step1 onNext={() => setStep(2)} />}

      {step === 2 && (
        <>
          <ComicDataEditor
            comicData={comicData}
            onUpdate={setComicData}
            artists={artists}
            comics={comics}
          />

          <Step3Pagemanager comicData={comicData} onUpdate={setComicData} />

          <Step4Thumbnail />

          <TagsEditor
            allTags={tags}
            comicData={comicData}
            onUpdate={setComicData}
            className="mt-8"
          />

          <h4 className="mt-8">Finish</h4>

          {error && <InfoBox variant="error" text={error} className="mt-2 mb-4 w-fit" />}

          {isSubmitting && (
            <InfoBox variant="info" boldText={false} className="mt-2 mb-4">
              <p>Uploading comic - this could take a little while, please be patient!</p>
            </InfoBox>
          )}

          <LoadingButton
            text="Submit"
            color="primary"
            variant="contained"
            isLoading={isSubmitting}
            onClick={submit}
          />
        </>
      )}
    </div>
  );
}

function pageNumberToPageName(pageNum: number, filename: string): string {
  const pageNumberString: string =
    pageNum < 100 ? (pageNum < 10 ? '00' + pageNum : '0' + pageNum) : pageNum.toString();
  return `${pageNumberString}.${getFileExtension(filename)}`;
}

function getFileExtension(filename: string) {
  return filename.substring(filename.lastIndexOf('.') + 1);
}

function validateUploadForm(uploadBody: UploadBody): { error?: string } {
  if (!uploadBody.comicName) {
    return { error: 'Comic name is required' };
  }
  if (uploadBody.comicName.length < 2) {
    return { error: 'Comic name must be at least 2 characters' };
  }
  if (illegalComicNameChars.some(char => uploadBody.comicName.includes(char))) {
    return { error: 'Comic name contains illegal characters' };
  }
  if (!uploadBody.category) {
    return { error: 'Category is required' };
  }
  if (!uploadBody.classification) {
    return { error: 'Classification is required' };
  }
  if (!uploadBody.state) {
    return { error: 'State is required' };
  }
  if (!uploadBody.artistId && !uploadBody.newArtist) {
    return { error: 'Artist is required' };
  }
  return {};
}

async function uploadFiles(
  comicData: NewComicData,
  uploadId: string,
  uploadUrlBase: string
): Promise<{ error?: string }> {
  const thumbnailFile = comicData.thumbnailFile as File;

  const filesFormDatas = Array<FormData>();
  let currentFormData = new FormData();
  currentFormData.append(
    'files',
    thumbnailFile,
    `thumbnail.${getFileExtension(thumbnailFile.name)}`
  );
  currentFormData.append('comicName', comicData.comicName);
  currentFormData.append('uploadId', uploadId);
  let currentFormDataSize = 0;

  for (let i = 0; i < comicData.files.length; i++) {
    const file = comicData.files[i];
    // Split the request into multiple FormDatas/submissions if size is too big.
    if (currentFormDataSize + file.size > maxUploadBodySize) {
      filesFormDatas.push(currentFormData);
      currentFormData = new FormData();
      currentFormData.append('comicName', comicData.comicName);
      currentFormDataSize = 0;
    }

    currentFormData.append(`files`, file, pageNumberToPageName(i + 1, file.name));
    currentFormDataSize += file.size;
  }
  filesFormDatas.push(currentFormData);

  const uploadPromises = filesFormDatas.map(uploadFormData =>
    fetch(`${uploadUrlBase}/new-api/upload-pages`, {
      method: 'POST',
      body: uploadFormData,
    })
  );
  const responses = await Promise.all(uploadPromises);

  for (const response of responses) {
    if (!response.ok) {
      return { error: response.statusText };
    }
  }

  return {};
}

function generateRandomId() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function createEmptyUploadData(): NewComicData {
  return {
    comicName: '',
    category: '',
    classification: '',
    state: '',
    tags: [],
    newArtist: {
      artistName: '',
      e621Name: '',
      patreonName: '',
      links: [''],
      isValidName: false,
    },
    // Validation that must be computed from within components, rather than on submit
    validation: {
      isLegalComicName: false,
    },
    files: [],
  };
}

export type NewArtist = {
  id?: number;
  artistName: string;
  e621Name: string;
  patreonName: string;
  links: string[];
  isValidName?: boolean;
  hasConfirmedNoE621Name?: boolean;
  hasConfirmedNoPatreonName?: boolean;
};

// The submitted payload
export type UploadBody = {
  uploadId: string;
  comicName: string;
  artistId?: number;
  newArtist?: NewArtist;
  category: string;
  classification: string;
  state: string;
  previousComic?: ComicTiny;
  nextComic?: ComicTiny;
  tagIds: number[];
  numberOfPages: number;
};

// For handling upload data internally in the front-end
export type NewComicData = {
  comicId?: number;
  comicName: string;
  artistId?: number;
  uploadArtistId?: number;
  newArtist: NewArtist;
  category: string;
  classification: string;
  state: string;
  previousComic?: ComicTiny;
  nextComic?: ComicTiny;
  tags: Tag[];
  validation: {
    isLegalComicName: boolean;
  };
  files: File[];
  thumbnailFile?: File;
};
