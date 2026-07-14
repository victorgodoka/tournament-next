import { Tournament } from "../tournament/tournament.types";

export type TournamentGetProps = {
  page?: number;
  limit?: number;
}
export interface TournamentsListResponse {
  success: boolean;
  message: string;
  data: {
    tournaments: Tournament[];
    pagination: TournamentPagination;
  };
}

export interface TournamentPagination {
  currentPage: number;
  totalPages: number;
  totalTournaments: number;
  limit: number;
}
