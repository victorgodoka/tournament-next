import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { AvatarComponent, DeckListComponent, SkeletonComponent } from "@components";
import { discordAvatar } from "@assets/discord.avatar";
import { cached } from "@lib/client-cache";
import { convertDeck } from "../decks/decks.api";
import { ConvertedDeck } from "../decks/decks.types";
import { TournamentDetail, TournamentUser } from "./tournament.types";
import { getUserDisplayName } from "./tournament-page.utils";

type PlayerDeck = {
  player: TournamentUser;
  deck: ConvertedDeck | null;
};

type LoadState = "loading" | "ready" | "error";

/** Placeholder decklists shown while the top-cut decks are being fetched. */
const TopcutSkeleton = ({ count }: { count: number }) => (
  <ol
    className="tournament-topcut__players"
    role="status"
    aria-label="Loading decklists"
  >
    {Array.from({ length: Math.max(count, 1) }).map((_, index) => (
      <li key={index} className="tournament-topcut__player omega-surface">
        <div className="tournament-topcut__player-head">
          <SkeletonComponent width={28} height={28} circle />
          <SkeletonComponent width={40} height={40} circle />
          <div className="tournament-topcut__player-meta">
            <SkeletonComponent width="9rem" height={16} />
            <SkeletonComponent width="4rem" height={11} />
          </div>
        </div>
        <div className="tournament-topcut__skeleton-grid">
          {Array.from({ length: 15 }).map((__, cardIndex) => (
            <SkeletonComponent
              key={cardIndex}
              className="tournament-topcut__skeleton-card"
            />
          ))}
        </div>
      </li>
    ))}
  </ol>
);

const TournamentTopCut = ({ topcutPlayers, topcutData }: TournamentDetail) => {
  const [playerDecks, setPlayerDecks] = useState<PlayerDeck[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    if (!topcutPlayers?.length) return;

    let active = true;
    setState("loading");

    Promise.all(
      topcutPlayers.map(async (player) => {
        if (!player.deck?.code) return { player, deck: null };
        try {
          // Deck conversion is deterministic, so cache it permanently — the
          // decklists never reload once fetched, even across tab switches.
          const code = player.deck.code;
          const deck = await cached(`deck:${code}`, () => convertDeck(code), {
            permanent: true,
          });
          return { player, deck };
        } catch {
          return { player, deck: null };
        }
      }),
    )
      .then((results) => {
        if (!active) return;
        // Each conversion is caught per-player, so Promise.all won't reject.
        // Surface the error state only when every deck we tried to load failed.
        const attempted = topcutPlayers.filter((player) => player.deck?.code).length;
        const loaded = results.filter((result) => result.deck !== null).length;
        if (attempted > 0 && loaded === 0) {
          setState("error");
          return;
        }
        setPlayerDecks(results);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });

    return () => {
      active = false;
    };
  }, [topcutPlayers]);

  if (!topcutPlayers?.length || !topcutData) {
    return (
      <div className="tournament-topcut tournament-topcut--empty" role="status">
        <Icon
          icon="mdi:trophy-outline"
          className="tournament-topcut__empty-icon"
          aria-hidden="true"
        />
        <p>The top cut hasn&apos;t been decided yet.</p>
      </div>
    );
  }

  return (
    <div className="tournament-topcut">
      <header className="tournament-topcut__summary" role="status">
        <span className="tournament-topcut__summary-stat">
          <strong>{topcutData.totalPlayers}</strong> players
        </span>
        <span className="tournament-topcut__summary-divider" aria-hidden="true" />
        <span className="tournament-topcut__summary-stat">
          <strong>{topcutData.uniqueDecks}</strong> unique decks
        </span>
      </header>

      {state === "loading" ? (
        <TopcutSkeleton count={topcutPlayers.length} />
      ) : state === "error" ? (
        <div className="tournament-topcut__loading" role="status" aria-live="polite">
          <Icon
            icon="mdi:alert-circle-outline"
            className="tournament-topcut__error-icon"
            aria-hidden="true"
          />
          <span>Couldn&apos;t load decklists. Please try again later.</span>
        </div>
      ) : (
        <ol className="tournament-topcut__players">
          {playerDecks.map(({ player, deck }, index) => {
            const name = getUserDisplayName(player);
            const archetype = player.deck?.primaryArchetype;

            return (
              <li
                key={player.user_id}
                className="tournament-topcut__player omega-surface"
              >
                <header className="tournament-topcut__player-head">
                  <span className="tournament-topcut__seed">{index + 1}</span>
                  <AvatarComponent
                    src={discordAvatar(player.user_id, player.avatar)}
                    alt={name}
                    size="md"
                    shape="circle"
                  />
                  <div className="tournament-topcut__player-meta">
                    <h3 className="tournament-topcut__player-name">{name}</h3>
                    <p className="tournament-topcut__player-record">
                      {player.stats.wins}
                      <span aria-hidden="true"> - </span>
                      {player.stats.loses}
                      {player.stats.draws > 0 && (
                        <>
                          <span aria-hidden="true"> - </span>
                          {player.stats.draws}
                        </>
                      )}
                    </p>
                  </div>
                </header>

                {deck ? (
                  <DeckListComponent convertedDeck={deck} archetype={archetype} />
                ) : (
                  <p className="tournament-topcut__no-deck">
                    No decklist available for this player.
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default TournamentTopCut;
