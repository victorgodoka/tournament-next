export interface CardsSearchParams {
  // HTTP Method
  method?: 'GET' | 'POST';

  // Text search
  q?: string;
  name?: string;
  fname?: string;
  desc?: string;

  // ID / Alias
  id?: number | string | Array<number | string>;
  ids?:Array<number | string>;

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
    total?: number;
    totalPages?: number;
  };
  error?: string;
}

export interface CardSet {
  code: string;
  name: string | null;
}

export interface Card {
  id: number;
  /** Only set when this card itself is a reprint (`alias != 0` upstream). */
  canonicalId?: number;
  name_en: string | null;
  desc_en?: string | null;
  name_pt?: string | null;
  desc_pt?: string | null;
  level?: number | null;
  atk?: number | null;
  def?: number | null;
  sets: CardSet[];
  attribute?: string | null;
  race?: string | null;
  type_primary: string | null;
  type_tags: string[];
  genre_tags: string[];
  category_tags: string[];
  konami_id?: number | null;
  leftScale?: number | null;
  rightScale?: number | null;
  banlist_data?: BanlistData;
  /** Ids of every reprint/alt-art pointing to this card. Empty when none. */
  alias: number[];
  /** Id of a different card this one shares its 3-copy deck limit with
   * (e.g. errata'd reprints under one banlist entry). Omitted when none. */
  rule?: number;
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