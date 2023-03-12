import { Outlet, useNavigate, useOutletContext } from '@remix-run/react';
import { useEffect, useState } from 'react';
import SearchableSelect from '~/components/SearchableSelect/SearchableSelect';
import { ArtistTiny } from '~/types/types';
import { GlobalAdminContext } from '../admin';

export default function ManageArtists({}) {
  const navigate = useNavigate();

  const [selectedArtist, setSelectedArtist] = useState<ArtistTiny>();

  const globalContext: GlobalAdminContext = useOutletContext();

  const artistOptions = globalContext.artists.map(artist => ({
    value: artist,
    text: artist.name,
  }));

  // update url on selected comic change
  useEffect(() => {
    if (!selectedArtist) return;
    navigate(`/admin/artists/${selectedArtist.id}`);
  }, [selectedArtist]);

  return (
    <>
      <h1>Artist manager</h1>

      <SearchableSelect
        options={artistOptions}
        value={selectedArtist}
        onChange={setSelectedArtist}
        onValueCleared={() => setSelectedArtist(undefined)}
        title="Select artist"
        name="artist"
        className="mb-8"
      />

      <Outlet context={globalContext} />
    </>
  );
}
