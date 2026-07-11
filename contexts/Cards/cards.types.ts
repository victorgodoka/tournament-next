export interface CardsSearchParams {
  // HTTP Method
  method?: 'GET' | 'POST';

  // Text search
  fname?: string;
  q?: string;
  desc?: string;

  // ID / Alias
  id?: number | string | Array<number | string>;
  // Region
  region?: 'OCG' | 'TCG' | 'WCS' | 'GENESYS' | 'Genesys' | 'ALL';

  // Numeric filters
  atkMin?: number;
  atkMax?: number;
  defMin?: number;
  defMax?: number;
  levelMin?: number;
  levelMax?: number;
  pScale?: number;

  // Attribute
  attribute?: 'EARTH' | 'WATER' | 'FIRE' | 'WIND' | 'LIGHT' | 'DARK' | 'DIVINE';

  // Race
  race?: string;

  // Type
  type?: 'Monster' | 'Spell' | 'Trap' | 'Token';

  // Sets
  setcode?: string;
  sets?: string;
  page?: string | number;
  pageSize?: string | number;
}

export interface CardsSearchResponse {
  success: boolean;
  data?: {
    cards: Card[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export interface CardSet {
  code: string;
  name: string | null;
}

export interface Card {
  id: number;
  canonicalId?: number;
  name_en: string;
  desc_en?: string;
  name_pt?: string;
  desc_pt?: string;
  level?: number;
  atk?: number;
  def?: number;
  sets: CardSet[];
  attribute?: string;
  race?: string;
  type_primary: string;
  type_tags: string[];
  genre_tags: string[];
  category_tags: string[];
  konami_id?: number;
  leftScale?: number | null;
  rightScale?: number | null;
  banlist_data?: BanlistData;
}

export interface RegionBanlistInfo {
  banlist?: string;
  value?: number;
  status?: string;
}

export interface BanlistData {
  tcg?: RegionBanlistInfo;
  ocg?: RegionBanlistInfo;
  wcs?: RegionBanlistInfo;
  genesys?: RegionBanlistInfo;
}