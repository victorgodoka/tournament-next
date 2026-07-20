import { ApiResult } from "@lib/api-result";
import { SavedDeckComments, SavedDeckDetails } from "../decks.types";
import { API_ENDPOINTS } from "@const";

export const getDeck = async (
  deckId: string,
  token?: string
): Promise<ApiResult<SavedDeckDetails>> => {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_ENDPOINTS.MAIN}/saved-decks/deck/${deckId}`, {
      method: "GET",
      headers,
    });
    if (!response.ok) {
      return {
        ok: false,
        message: 'Failed to fetch deck data',
      }
    }

    const json: { success: boolean; data: SavedDeckDetails } = await response.json()
    return { ok: true, data: json.data }

  } catch (error) {
    console.error("Get Deck Error:", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export const getDeckComments = async (
  deckId: string
): Promise<ApiResult<SavedDeckComments>> => {
  try {
    const response = await fetch(`${API_ENDPOINTS.MAIN}/saved-decks/${deckId}/comments`, {
      method: "GET"
    });
    if (!response.ok) {
      return {
        ok: false,
        message: 'Failed to fetch deck data',
      }
    }

    const json: { success: boolean; data: SavedDeckComments } = await response.json()

    return { ok: true, data: json.data }

  } catch (error) {
    console.error("Get Deck Error:", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
