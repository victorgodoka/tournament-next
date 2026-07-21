import { API_ENDPOINTS } from "@const";
import { buildCardLookup, isExtra } from "@lib/cards.utils";
import { ConvertedDeck } from "@app/decks/decks.types";

export const downloadYDK = ({ name, fullDeck, primaryArchetypeWeighted, uniqueCardsData }: ConvertedDeck & { name?: string }) => {
  // The encoded deck stores extra-deck cards mixed into `main`; split them
  // out by card type so the .ydk sections are correct.
  const lookup = buildCardLookup(uniqueCardsData ?? []);
  const isExtraId = (id: number) => {
    const card = lookup.get(id);
    return card !== undefined && isExtra(card);
  };

  const main = fullDeck.main.filter((id) => !isExtraId(id));
  const extra = fullDeck.main.filter(isExtraId);

  const content = `#created by Duelist Unite\n\n#main\n${main.join("\n")}\n#extra\n${extra.join("\n")}\n!side\n${fullDeck.side.join("\n")}`;
  download(content, name || primaryArchetypeWeighted);
}

export const download = (text: string, name?: string) => {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = (name || "deck") + ".ydk";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const importOmega = async (code: string, name?: string) => {
  const url = `${API_ENDPOINTS.OMEGA}/add-deck/${name || "New Deck"}/${encodeURIComponent(code)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to import deck to Omega");
  }
}
