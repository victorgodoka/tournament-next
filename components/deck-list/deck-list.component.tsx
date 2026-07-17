'use client'

import { useMemo, useState } from "react";
import { ConvertedDeck } from "../../app/decks/decks.types";
import {
  buildCardLookup,
  cardCategory,
  cardImageUrl,
  EXTRA_TYPES,
  extraDeckType,
  groupDeckCards,
  isExtra,
  type CardCategory,
  type DeckCardGroup,
} from "@lib/cards.utils";
import ToggleComponent from "../toggle/toggle.component";
import { CARD_PLACEHOLDER_SRC } from "../../app/profile/profile.const";
import "./deck-list.styles.css";
import AffiliateLinkComponent from "../affiliate-link/affiliate-link-component";

type ListMode = "gallery" | "text";

const CATEGORY_RANK: Record<CardCategory, number> = {
  monster: 0,
  spell: 1,
  trap: 2,
};

const sumCopies = (groups: DeckCardGroup[]) =>
  groups.reduce((total, group) => total + group.count, 0);

/** Main/Side ordering: monsters → spells → traps, stable within a bucket. */
const byCategory = (a: DeckCardGroup, b: DeckCardGroup) =>
  CATEGORY_RANK[cardCategory(a.card)] - CATEGORY_RANK[cardCategory(b.card)];

/** Extra deck ordering: fusion → synchro → xyz → link. */
const byExtraType = (a: DeckCardGroup, b: DeckCardGroup) => {
  const rank = (group: DeckCardGroup) => {
    const index = EXTRA_TYPES.indexOf(extraDeckType(group.card) ?? "");
    return index === -1 ? EXTRA_TYPES.length : index;
  };
  return rank(a) - rank(b);
};

const cardName = (group: DeckCardGroup) =>
  group.card?.name_en ?? `Card #${group.id}`;

const DeckListComponent = ({ convertedDeck, archetype }: { convertedDeck: ConvertedDeck; archetype?: string }) => {
  const [listMode, setListMode] = useState<ListMode>("gallery");
  const { fullDeck, uniqueCardsData } = convertedDeck;

  const { mainDeck, extraDeck, sideDeck } = useMemo(() => {
    const lookup = buildCardLookup(uniqueCardsData ?? []);
    const mainGroups = groupDeckCards(fullDeck?.main ?? [], lookup);

    // The API mixes extra-deck cards into `fullDeck.main` and exposes the
    // fusion/synchro/xyz/link subtype only through card data. A card is treated
    // as extra only when we positively identify it as such; unresolved cards
    // (missing hydrated data) fall back to the main deck rather than being
    // dropped or guessed into the extra deck.
    const isExtraGroup = (group: DeckCardGroup) =>
      group.card !== null && isExtra(group.card);

    return {
      mainDeck: mainGroups.filter((group) => !isExtraGroup(group)).sort(byCategory),
      extraDeck: mainGroups.filter(isExtraGroup).sort(byExtraType),
      sideDeck: groupDeckCards(fullDeck?.side ?? [], lookup).sort(byCategory),
    };
  }, [fullDeck, uniqueCardsData]);

  const sections = [
    { key: "main", label: "Main Deck", groups: mainDeck },
    { key: "extra", label: "Extra Deck", groups: extraDeck },
    { key: "side", label: "Side Deck", groups: sideDeck },
  ].filter((section) => section.groups.length > 0);

  return (
    <div className="deck-list">
      <div className="deck-list__header">
        {archetype && (
          <span className="omega-badge omega-badge--secondary tournament-topcut__archetype">
            {archetype}
          </span>
        )}
        <ToggleComponent<ListMode>
          options={[
            { label: "Gallery", value: "gallery", icon: "mdi:view-gallery" },
            { label: "Text", value: "text", icon: "mdi:text-box-outline" },
          ]}
          value={listMode}
          onChange={setListMode}
          size="sm"
          ariaLabel="Decklist view"
        />
      </div>

      <div className="deck-list__body">
        {sections.map((section) => (
          <section
            key={section.key}
            className="deck-list__section"
            aria-label={section.label}
          >
            <h4 className="deck-list__section-title">
              {section.label}
              <span className="deck-list__section-count">
                {sumCopies(section.groups)}
              </span>
            </h4>

            {listMode === "gallery" ? (
              <ul className="deck-list__grid">
                {section.groups.map((group) => (
                  <li
                    key={group.id}
                    className="deck-list__card"
                    title={cardName(group)}
                    data-category={cardCategory(group.card)}
                  >
                    <AffiliateLinkComponent name={cardName(group)}>
                      <img
                        className="deck-list__card-img"
                        src={cardImageUrl(group.id)}
                        alt={cardName(group)}
                        loading="lazy"
                        decoding="async"
                        onError={(event) => {
                          event.currentTarget.src = CARD_PLACEHOLDER_SRC;
                        }}
                      />
                    </AffiliateLinkComponent>
                    {group.count > 1 && (
                      <span className="deck-list__card-count" aria-hidden="true">
                        ×{group.count}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="deck-list__text">
                {section.groups.map((group) => (
                  <li
                    key={group.id}
                    data-category={cardCategory(group.card)}
                  >
                    <AffiliateLinkComponent className="deck-list__text-row" name={cardName(group)}>
                      <span className="deck-list__text-count">{group.count}</span>
                      <span className="deck-list__text-name">{cardName(group)}</span>
                    </AffiliateLinkComponent>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};

export default DeckListComponent;
