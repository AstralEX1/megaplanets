import './Landing.css';
import { useEffect } from 'react';
import Lightfall from '@/components/landing/Lightfall';
import { LandingLiveJackpot } from '@/components/landing/LandingLiveJackpot';
import { LandingHowItWorks } from '@/components/landing/LandingHowItWorks';
import { LandingPlanetCard } from '@/components/landing/LandingPlanetCard';
import { LandingSplitText } from '@/components/landing/LandingSplitText';
import { PlanetGeneratorHero } from '@/components/landing/PlanetGeneratorHero';

const generatedPlanetAssets = [
  { image: '/artifacts/megastera-generated/planet-01.gif', name: 'Draheunia', rarity: 'Common', ticketId: '5001', minerals: 25 },
  { image: '/artifacts/megastera-generated/planet-05.gif', name: 'Wheuagawa III', rarity: 'Uncommon', ticketId: '5005', minerals: 75 },
  { image: '/artifacts/megastera-generated/planet-09.gif', name: 'Auclagua-94', rarity: 'Common', ticketId: '5009', minerals: 10 },
] as const;

export function Landing() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Megastera';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="landing" data-testid="megastera-landing">
      <a className="landing-skip-link" href="#landing-main">Skip to content</a>
      <header className="landing-header">
        <a className="landing-wordmark" href="/" aria-label="Megastera home">
          <span className="landing-wordmark-mark" aria-hidden="true">M</span>
          <LandingSplitText text="Megastera" className="landing-wordmark-name" />
        </a>
        <a className="landing-button landing-button-small" href="/play">
          <LandingSplitText text="Play" className="landing-button-label" />
        </a>
      </header>

      <main id="landing-main">
        <section className="landing-hero landing-container" aria-labelledby="hero-title">
          <div className="landing-hero-lightfall" aria-hidden="true">
            <Lightfall
              colors={['#aeb9ff', '#b28cff', '#50d2a0']}
              backgroundColor="#030307"
              speed={0.18}
              streakCount={3}
              streakWidth={1.2}
              streakLength={0.8}
              glow={0.8}
              density={0.45}
              twinkle={0.35}
              zoom={2.6}
              backgroundGlow={0.22}
              opacity={0.62}
              mouseInteraction
              mouseStrength={0.6}
              mouseRadius={0.7}
              mouseDampening={0.18}
              mixBlendMode="screen"
              dpr={0.85}
            />
          </div>
          <div className="landing-hero-copy">
            <LandingSplitText
              tag="span"
              className="landing-kicker"
              text="A planet-first cosmic lottery game"
              delay={28}
              duration={0.62}
            />
            <h1 id="hero-title" className="landing-hero-title">
              <LandingSplitText
                tag="span"
                className="landing-split-line"
                text="Explore Planets."
                delay={34}
                duration={0.78}
                splitType="chars"
                from={{ opacity: 0, y: 48, rotateX: -70 }}
                to={{ opacity: 1, y: 0, rotateX: 0 }}
              />
              <LandingSplitText
                tag="span"
                className="landing-split-line landing-split-line-accent"
                text="Win prizes."
                delay={46}
                duration={0.86}
                from={{ opacity: 0, y: 52, rotateX: -70, filter: 'blur(8px)' }}
                to={{ opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)' }}
                splitType="chars"
              />
            </h1>
            <LandingSplitText
              tag="p"
              className="landing-hero-subtitle"
              text="Every ticket becomes a Planet and enters the draw."
              splitType="lines"
              delay={72}
              duration={0.8}
            />
            <LandingSplitText
              tag="span"
              className="landing-hero-powered-by"
              text="powered by Megapot"
              delay={86}
              duration={0.64}
            />
            <div className="landing-hero-actions">
              <a className="landing-button" href="/play">
                <LandingSplitText text="Play" className="landing-button-label" />
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>

          <div className="landing-hero-visual">
            <PlanetGeneratorHero />
          </div>

          <div className="landing-hero-live">
            <LandingLiveJackpot />
          </div>
        </section>

        <section className="landing-section landing-container landing-mechanics" aria-labelledby="mechanics-title" aria-label="Two mechanics: Megapot Ticket and Planet">
          <div className="landing-mechanics-heading">
            <div>
              <LandingSplitText tag="span" className="landing-kicker" text="Two mechanics" />
              <h2 id="mechanics-title">
                <LandingSplitText tag="span" className="landing-mechanics-title-line" text="One ticket." />
                <LandingSplitText
                  tag="span"
                  className="landing-mechanics-title-line landing-split-line-accent"
                  text="One Planet."
                  delay={48}
                  duration={0.82}
                />
              </h2>
            </div>
            <LandingSplitText
              tag="p"
              className="landing-mechanics-intro"
              text="One Megapot Ticket creates one traceable Planet. The two stay linked from the draw to the leaderboard."
              splitType="lines"
              delay={74}
              duration={0.82}
            />
          </div>

          <div className="landing-mechanics-grid">
            <article className="landing-mechanic landing-ticket-mechanic">
              <LandingSplitText tag="span" className="landing-micro-label" text="01 / MEGAPOT TICKET" />
              <div className="landing-ticket-visual">
                <div className="landing-megapot-ticket" role="img" aria-label="Megapot Ticket preview with five numbers and one bonus ball">
                  <div className="landing-megapot-ticket-head">
                    <LandingSplitText tag="span" className="landing-ticket-visual-top" text="MEGAPOT / DAILY DRAW" delay={24} />
                    <LandingSplitText tag="span" className="landing-megapot-ticket-price" text="$1 USDC" delay={28} />
                  </div>
                  <LandingSplitText tag="strong" className="landing-ticket-visual-title" text="TICKET" splitType="chars" delay={42} />
                  <div className="landing-ticket-balls" aria-hidden="true">
                    {[7, 14, 18, 23, 29].map((number) => <span className="landing-ticket-ball" key={number}>{number}</span>)}
                    <span className="landing-ticket-ball landing-ticket-ball-bonus">3</span>
                  </div>
                  <div className="landing-megapot-ticket-foot">
                    <LandingSplitText tag="span" className="landing-ticket-visual-bottom" text="5 NUMBERS + BONUS" delay={24} />
                    <LandingSplitText tag="span" className="landing-megapot-ticket-id" text="TICKET / 5001" delay={28} />
                  </div>
                </div>
              </div>
              <h3><LandingSplitText tag="span" text="Megapot Ticket" /></h3>
              <LandingSplitText
                tag="p"
                text="The ticket enters the Megapot draw and can win the jackpot."
                splitType="lines"
                delay={66}
                duration={0.78}
              />
            </article>

            <div className="landing-mechanics-connection" aria-hidden="true">
              <LandingSplitText tag="span" text="ONE TICKET" delay={24} duration={0.58} />
              <i>→</i>
              <LandingSplitText tag="span" text="ONE PLANET" delay={24} duration={0.58} />
            </div>

            <article className="landing-mechanic landing-planet-mechanic">
              <LandingSplitText tag="span" className="landing-micro-label" text="02 / PLANET" />
              <div className="landing-mechanic-planet-stack">
                {generatedPlanetAssets.map((planet) => (
                  <LandingPlanetCard
                    key={planet.ticketId}
                    image={planet.image}
                    name={planet.name}
                    rarity={planet.rarity}
                    ticketId={planet.ticketId}
                    minerals={planet.minerals}
                  />
                ))}
              </div>
              <h3><LandingSplitText tag="span" text="Planet" /></h3>
              <LandingSplitText
                tag="p"
                text="The Planet is tied to that ticket, mines minerals and competes on the leaderboard for extra rewards."
                splitType="lines"
                delay={66}
                duration={0.82}
              />
            </article>
          </div>

          <div className="landing-mechanics-proof">
            <LandingSplitText tag="span" className="landing-micro-label" text="TICKET PROVENANCE" />
            <LandingSplitText
              tag="span"
              className="landing-proof-copy"
              text="Every Planet carries the ticket that created it."
              delay={52}
            />
            <a className="landing-button landing-button-small" href="/play">
              <LandingSplitText text="Play" className="landing-button-label" />
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        <LandingHowItWorks />
      </main>

      <footer className="landing-footer landing-container">
        <a className="landing-wordmark" href="/" aria-label="Megastera home">
          <span className="landing-wordmark-mark" aria-hidden="true">M</span>
          <LandingSplitText text="Megastera" className="landing-wordmark-name" />
        </a>
        <LandingSplitText tag="span" className="landing-footer-tagline" text="Explore Planets. Win prizes." />
        <LandingSplitText
          tag="span"
          className="landing-footer-meta"
          text="Ticket → Planet → Rewards"
        />
      </footer>
    </div>
  );
}
