import { API_ENDPOINTS } from "@const"
import { ExportingDeck } from "./deck-export.types";
import { isExtra } from "@lib/cards.utils";
import { ConvertedDeck } from "@app/decks/decks.types";

export const downloadYDK = async ({ name, fullDeck, uniqueCards, primaryArchetypeWeighted, uniqueCardsData }: ConvertedDeck & { name?: string }) => {
  const getData = (c: number) => uniqueCardsData[c] || null;

  const exportingDeck: ExportingDeck = { 
    main: fullDeck.main, 
    side: fullDeck.side, 
    extra: fullDeck.main.filter((cardId) => uniqueCards[cardId] && getData(cardId) && isExtra(getData(cardId)))
  };

  const copyright = `#created by Duelist Unite\n`
  const mainDeck = exportingDeck.main.map((cardId) => `${cardId}`).join("\n");
  const extraDeck = exportingDeck.extra.map((cardId) => `${cardId}`).join("\n");
  const sideDeck = exportingDeck.side.map((cardId) => `${cardId}`).join("\n");
  const content = `${copyright}\n#main\n${mainDeck}\n#extra\n${extraDeck}\n!side\n${sideDeck}`

  return download(content, name || primaryArchetypeWeighted);
}

export const download = async (text: string, name?: string) => {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = (name || "deck") + ".ydk";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const importOmega = async (code: string, name?: string) => {
  const url = `${API_ENDPOINTS.OMEGA}/add-deck/${name || "New Deck"}/${encodeURIComponent(code)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to import deck to Omega");
  }
}
