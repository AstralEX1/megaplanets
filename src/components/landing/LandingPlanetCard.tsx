import type { PlanetRarity } from '@megaplanets/planet-generator';
import mineralIcon from '@/assets/mineral-icon.png';
import { rarityBorderClass } from '@/lib/planetInventory';
import { LandingSplitText } from './LandingSplitText';

type LandingPlanetCardProps = {
  image: string;
  name: string;
  rarity: PlanetRarity;
  ticketId: string;
  minerals: number;
};

export function LandingPlanetCard({ image, name, rarity, ticketId, minerals }: LandingPlanetCardProps) {
  return (
    <article
      className={`landing-planet-card landing-my-planet-card ${rarityBorderClass(rarity)} landing-my-planet-card--${rarity.toLowerCase()}`}
      data-rarity={rarity}
    >
      <div className="landing-my-planet-card-media">
        <img src={image} alt={`${name} Planet preview`} loading="lazy" />
      </div>
      <div className="landing-my-planet-card-body">
        <div className="landing-my-planet-card-heading">
          <LandingSplitText tag="h3" className="landing-my-planet-card-name" text={name} />
          <LandingSplitText tag="span" className="landing-my-planet-card-id" text={`Ticket #${ticketId}`} />
        </div>
        <div className="landing-my-planet-card-metrics">
          <span className="landing-my-planet-card-minerals">
            <img src={mineralIcon} alt="Minerals" />
            <LandingSplitText tag="span" text={minerals.toString()} />
          </span>
          <LandingSplitText tag="span" className="landing-my-planet-card-status" text="Drawing" />
        </div>
      </div>
    </article>
  );
}
