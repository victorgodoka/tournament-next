import { apiFailure, apiSuccess, type ApiResult } from "@lib/api-result";
import { authHeader } from "@lib/auth-header";
import { SavedDeckComments, SavedDeckDetails } from "../decks.types";
import { normalizeSavedDeckDetails, parseSavedDeckComments } from "../decks.validation";
import { API_ENDPOINTS } from "@const";

// Both helpers run on the server (deck detail page). The token is the raw
// httpOnly session JWT read via getSessionToken() — never expose these to a
// client component, since the browser cannot supply the token.

export const getDeck = async (
  deckId: string,
  token?: string | null
): Promise<ApiResult<SavedDeckDetails>> => {
  try {
    const response = await fetch(`${API_ENDPOINTS.MAIN}/saved-decks/deck/${encodeURIComponent(deckId)}`, {
      method: "GET",
      headers: authHeader(token),
    });
    if (!response.ok) {
      return apiFailure("Failed to fetch deck data");
    }

    const deck = normalizeSavedDeckDetails(await response.json());
    if (!deck) {
      return apiFailure("Invalid deck response");
    }

    return apiSuccess(deck);
  } catch (error) {
    console.error("Get Deck Error:", error);
    return apiFailure(error instanceof Error ? error.message : "Unknown error");
  }
};

export const getDeckComments = async (
  deckId: string,
  token?: string | null
): Promise<ApiResult<SavedDeckComments>> => {
  try {
    // Auth is optional but required to read a *private* deck's comments as its
    // owner — forward the session token so the owner isn't shown an empty list.
    const response = await fetch(`${API_ENDPOINTS.MAIN}/saved-decks/${encodeURIComponent(deckId)}/comments`, {
      method: "GET",
      headers: authHeader(token),
    });
    if (!response.ok) {
      return apiFailure("Failed to fetch deck comments");
    }

    const comments = parseSavedDeckComments(await response.json());
    if (!comments) {
      return apiFailure("Invalid deck comments response");
    }

    return apiSuccess(comments);
  } catch (error) {
    console.error("Get Deck Comments Error:", error);
    return apiFailure(error instanceof Error ? error.message : "Unknown error");
  }
};
