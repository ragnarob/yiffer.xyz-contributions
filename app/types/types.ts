export type Artist = {
  id: number;
  name: string;
  patreonName: string;
  e621Name: string;
};

export type Comic = {
  name: string;
  id: number;
  state: 'WIP' | 'Cancelled' | 'Finished';
  classification: 'Furry' | 'Pokemon' | 'MLP' | 'Other';
  category: 'M' | 'F' | 'MF' | 'MM' | 'FF' | 'MF+' | 'I';
  previousComic?: Comic;
  nextComic?: Comic;
  isPending?: boolean;
};

export interface JwtConfig {
  tokenSecret: string;
  cookie: {
    name: string;
    domain: string;
    secure: boolean;
    maxAge: number;
    httpOnly: boolean;
  };
}
