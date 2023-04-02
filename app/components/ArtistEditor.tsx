import { useFetcher } from '@remix-run/react';
import { useEffect, useRef, useState } from 'react';
import { MdDelete } from 'react-icons/md';
import Checkbox from '~/components/Checkbox/Checkbox';
import InfoBox from '~/components/InfoBox';
import TextInput from '~/components/TextInput/TextInput';
import { SimilarArtistResponse } from '~/routes/api/search-similar-artist';
import { Artist } from '~/types/types';
import { NewArtist } from '../routes/contribute/upload';
import IconButton from './Buttons/IconButton';

type NewArtistProps = {
  newArtistData: NewArtist;
  existingArtist?: Artist;
  onUpdate: (newData: NewArtist) => void;
  hideBorderTitle?: boolean;
  className?: string;
};

export default function ArtistEditor({
  newArtistData,
  existingArtist,
  onUpdate,
  hideBorderTitle = false,
  className = '',
}: NewArtistProps) {
  const similarArtistsFetcher = useFetcher();

  const [similarArtists, setSimilarArtists] = useState<SimilarArtistResponse>();
  const [hasConfirmedNewArtist, setHasConfirmedNewArtist] = useState(false);
  const [noLinks, setNoLinks] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (similarArtistsFetcher.data) {
      setSimilarArtists(similarArtistsFetcher.data);
    }
  }, [similarArtistsFetcher.data]);

  function updateArtist(newArtist: NewArtist) {
    onUpdate(newArtist);
  }

  useEffect(() => {
    setHasConfirmedNewArtist(false);
    setSimilarArtists(undefined);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (
      newArtistData.artistName.length < 3 ||
      newArtistData.artistName === existingArtist?.name
    ) {
      return;
    }

    debounceTimeoutRef.current = setTimeout(() => {
      const body: any = { artistName: newArtistData.artistName };
      if (existingArtist) {
        body.excludeName = existingArtist.name;
      }

      similarArtistsFetcher.submit(body, {
        method: 'post',
        action: '/api/search-similar-artist',
      });
    }, 1000);
  }, [newArtistData.artistName, existingArtist?.name]);

  // Add new empty string link if all are filled
  useEffect(() => {
    const links = newArtistData.links;
    if (links.length > 0 && links.every(l => l.length > 0)) {
      updateArtist({ ...newArtistData, links: [...links, ''] });
    }
    if (!links.every(l => l.length === 0)) {
      setNoLinks(false);
    }
  }, [newArtistData.links]);

  // Update validity of name, as this data only exists here locally. All other validation is done in submit logic.
  useEffect(() => {
    let isLegal = false;

    if (similarArtists) {
      const isExactMatch =
        similarArtists.exactMatchArtist || similarArtists.exactMatchBannedArtist;
      const isAnyKindOfSimilarArtist =
        similarArtists.similarArtists.length > 0 ||
        similarArtists.similarBannedArtists.length > 0;

      if (!isExactMatch && newArtistData.artistName.length > 2) {
        isLegal = !isAnyKindOfSimilarArtist || hasConfirmedNewArtist;
      }
    }

    updateArtist({
      ...newArtistData,
      isValidName: isLegal,
    });
  }, [similarArtists, hasConfirmedNewArtist]);

  const isExactMatch =
    similarArtists &&
    (similarArtists.exactMatchArtist || similarArtists.exactMatchBannedArtist);

  const isAnySimilar =
    !isExactMatch &&
    similarArtists &&
    (similarArtists.similarArtists.length > 0 ||
      similarArtists.similarBannedArtists.length > 0);

  const uploadClassname = 'my-4 p-4 border border-4 border-theme1-primary flex flex-col';
  const adminPanelClassname = 'flex flex-col';

  return (
    <div
      className={`${
        hideBorderTitle ? adminPanelClassname : uploadClassname
      } ${className}`}
    >
      {!hideBorderTitle && <h3>New artist</h3>}

      <TextInput
        label="Artist name"
        name="artistName"
        value={newArtistData.artistName}
        onChange={newVal => updateArtist({ ...newArtistData, artistName: newVal })}
      />

      {isExactMatch && (
        <InfoBox
          variant="error"
          className="mt-2"
          text={
            similarArtists.exactMatchArtist
              ? 'An artist with this name already exists in the system'
              : 'An artist with this name has been banned or has requested their comics not be published here'
          }
        />
      )}

      {isAnySimilar && (
        <>
          {!hasConfirmedNewArtist && (
            <InfoBox variant="warning" className="mt-2" boldText={false}>
              {similarArtists.similarArtists.length > 0 && (
                <>
                  <p>
                    The following existing artist names are somewhat similar to the one
                    you entered:
                  </p>
                  <ul>
                    {similarArtists.similarArtists.map(name => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </>
              )}
              {similarArtists.similarBannedArtists.length > 0 && (
                <>
                  <p>
                    The artists are somewhat similar to the one you entered, and have been
                    banned or have requested their comics not be published here:
                  </p>
                  <ul>
                    {similarArtists.similarBannedArtists.map(name => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </>
              )}
            </InfoBox>
          )}

          <Checkbox
            label="This is not one of the above artists"
            checked={hasConfirmedNewArtist}
            onChange={setHasConfirmedNewArtist}
            className="mt-2"
          />
        </>
      )}

      <h4 className="mt-8">E621 and Patreon</h4>

      {!newArtistData.hasConfirmedNoE621Name && (
        <TextInput
          label="E621 name"
          name="e621Name"
          value={newArtistData.e621Name}
          onChange={newVal => updateArtist({ ...newArtistData, e621Name: newVal })}
          className="mt-2"
          helperText="Only the name - not the full link"
          placeholder='e.g. "braeburned"'
          disabled={newArtistData.hasConfirmedNoE621Name}
        />
      )}

      <Checkbox
        label="Artist is not on e621 (this is unlikely!)"
        checked={!!newArtistData.hasConfirmedNoE621Name}
        onChange={newVal => {
          const newArtist = { ...newArtistData, hasConfirmedNoE621Name: newVal };
          if (newVal) {
            newArtist.e621Name = '';
          }
          updateArtist(newArtist);
        }}
        className="mt-2"
      />

      {!newArtistData.hasConfirmedNoPatreonName && (
        <TextInput
          label="Patreon name"
          name="patreonName"
          value={newArtistData.patreonName}
          onChange={newVal => updateArtist({ ...newArtistData, patreonName: newVal })}
          className="mt-6"
          helperText="Only the name - not the full link"
          placeholder='e.g. "braeburned"'
          disabled={newArtistData.hasConfirmedNoPatreonName}
        />
      )}

      <Checkbox
        label="Artist is not on Patreon"
        checked={!!newArtistData.hasConfirmedNoPatreonName}
        onChange={newVal => {
          const newArtist = { ...newArtistData, hasConfirmedNoPatreonName: newVal };
          if (newVal) {
            newArtist.patreonName = '';
          }
          updateArtist(newArtist);
        }}
        className="mt-2"
      />

      <h4 className="mt-8">Other links</h4>
      {!hideBorderTitle && (
        <p className="mb-4">
          It's important to be on good terms with artists. Links to their profiles are
          vital. If you do not provide any links, or vastly insufficient ones, the comic
          might be rejected. Any website links go below here. Examples: Twitter,
          FurAffinity, Inkbunny, personal websites, etc. Full URLs.
        </p>
      )}

      <p>
        Tips for finding good links: Check FurAffinity, and check the e621 artist page, by
        clicking the “?” next to the artist's name in the top left of any post tagged by
        them, as illustrated in the picture below. If you cannot find any other sites,
        make one last attempt by Googling "furry &lt;artist name&gt;"".
      </p>

      <p>!!!!e621 pic here!!!!</p>

      <div className="flex flex-col gap-2 mt-4">
        {!noLinks && (
          <>
            {newArtistData.links.map((link, i) => {
              const isLastLink = i === newArtistData.links.length - 1;
              return (
                <div
                  className={`flex flex-row -mt-1 items-end ${isLastLink ? 'mr-10' : ''}`}
                >
                  <TextInput
                    key={i}
                    label={`Link:`}
                    name={`otherLink${i}`}
                    value={link}
                    placeholder="e.g. https://twitter.com/braeburned"
                    onChange={newVal => {
                      const newLinks = [...newArtistData.links];
                      newLinks[i] = newVal;
                      updateArtist({ ...newArtistData, links: newLinks });
                    }}
                    className="mt-2 grow"
                    disabled={noLinks}
                  />

                  {!isLastLink && (
                    <IconButton
                      className="ml-2 mt-4"
                      color="primary"
                      variant="naked"
                      icon={MdDelete}
                      onClick={() => {
                        const newLinks = [...newArtistData.links];
                        newLinks.splice(i, 1);
                        updateArtist({ ...newArtistData, links: newLinks });
                      }}
                    />
                  )}
                </div>
              );
            })}
          </>
        )}

        {newArtistData.links.every(l => l.length === 0) && (
          <Checkbox
            label="Artist has no links (unlikely!)"
            checked={noLinks}
            onChange={setNoLinks}
            className="mt-2"
          />
        )}
      </div>
    </div>
  );
}