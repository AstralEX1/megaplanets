import { LandingSplitText } from './LandingSplitText';

type LandingFaqItem = {
  question: string;
  answer: string;
};

const faqItems: readonly LandingFaqItem[] = [
  {
    question: 'What is a Megapot Ticket?',
    answer:
      'A Megapot Ticket is a $1 USDC entry for the daily draw. Each ticket is an independent chance at the published prize tiers, from smaller matches through the jackpot.',
  },
  {
    question: 'How does a ticket become a Planet?',
    answer:
      'Megastera binds one generated Planet to that ticket. The Planet is derived from the ticket and draw data, so its origin can be traced back to the exact draw entry that created it.',
  },
  {
    question: 'Is the Planet another ticket?',
    answer:
      'The Planet is not a second ticket or a second draw entry. It is the playable world attached to the same ticket: the ticket chases Megapot prizes while the Planet mines minerals and earns leaderboard position.',
  },
  {
    question: 'Who powers the jackpot?',
    answer:
      'Backers, also called liquidity providers, deposit USDC into the jackpot pool. Megapot documents that 70% of ticket value enters the jackpot pool; 20% goes to liquidity providers, and 10% supports referrals.',
  },
  {
    question: 'How is the draw decided?',
    answer:
      'A new drawing runs once each day. Pyth supplies verifiable randomness for the winning combination; the result and prize settlement are recorded onchain so anyone can verify the outcome.',
  },
  {
    question: 'What can a winning ticket receive?',
    answer:
      'A winning ticket can match one of Megapot’s prize tiers, including the jackpot. Winnings are paid in USDC, and every ticket is automatically considered for the published extra-prize program as well.',
  },
  {
    question: 'What happens after the draw?',
    answer:
      'The draw settles the ticket’s Megapot result, but it does not erase the Planet. Its ticket provenance stays attached, and the Planet continues its mineral and leaderboard journey inside Megastera.',
  },
  {
    question: 'How does the Planet leaderboard fit in?',
    answer:
      'Megapot prizes and Megastera leaderboard rewards are separate paths. The Planet mines minerals from its generated world and competes for additional Megastera rewards, while its linked ticket remains the source of the draw result.',
  },
];

export function LandingHowItWorks() {
  return (
    <section className="landing-section landing-container landing-how-it-works" aria-labelledby="how-it-works-title" aria-label="How it works">
      <div className="landing-how-it-works-heading">
        <div>
          <LandingSplitText tag="span" className="landing-kicker" text="FAQ / MECHANICS" />
          <h2 id="how-it-works-title">
            <LandingSplitText tag="span" text="How it works" />
          </h2>
        </div>
        <LandingSplitText
          tag="p"
          className="landing-how-it-works-intro"
          text="A Megapot Ticket powers two connected experiences: a daily chance at the jackpot and a Planet that keeps playing after the ticket is issued."
          splitType="lines"
          delay={72}
          duration={0.82}
        />
      </div>

      <div className="landing-faq-list">
        {faqItems.map((item, index) => (
          <details className="landing-faq-row" key={item.question} open={index === 0}>
            <summary className="landing-faq-summary">
              <LandingSplitText tag="span" className="landing-faq-index" text={`0${index + 1}`} delay={24} duration={0.58} />
              <LandingSplitText tag="span" className="landing-faq-question" text={item.question} delay={34} duration={0.64} />
              <span className="landing-faq-marker" aria-hidden="true" />
            </summary>
            <LandingSplitText
              tag="p"
              className="landing-faq-answer"
              text={item.answer}
              splitType="lines"
              delay={52}
              duration={0.76}
            />
          </details>
        ))}
      </div>
    </section>
  );
}
