
import SkeletonComponent from "../../components/skeleton/skeleton.component";

/** Full-page placeholder shown while a tournament's data is being fetched. */
const TournamentPageSkeleton = () => (
  <div className="tournament">
    

    <div
      className="tournament__content omega-container"
      role="status"
      aria-label="Loading tournament"
    >
      <section className="tournament__hero omega-surface tournament-skeleton__hero">
        <div className="tournament-skeleton__info">
          <SkeletonComponent width="6rem" height={22} radius="var(--radius-full)" />
          <SkeletonComponent width="15rem" height={34} />
          <div className="tournament-skeleton__badges">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonComponent
                key={index}
                width="5.5rem"
                height={26}
                radius="var(--radius-full)"
              />
            ))}
          </div>
        </div>
        <div className="tournament-skeleton__players">
          {Array.from({ length: 7 }).map((_, index) => (
            <SkeletonComponent key={index} width={40} height={40} circle />
          ))}
        </div>
      </section>

      <div className="tournament-skeleton__tabs">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonComponent
            key={index}
            width="8rem"
            height={40}
            radius="var(--radius-md)"
          />
        ))}
      </div>

      <div className="tournament-skeleton__panel">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonComponent key={index} height={72} radius="var(--radius-lg)" />
        ))}
      </div>
    </div>
  </div>
);

export default TournamentPageSkeleton;
