import { HOME_FAQ } from "@utils/const";
import { Band, Kicker, NOTE, Rail } from "./band";

/** Same answers as the visible list, so search engines can show them as FAQ results. */
const FAQ_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: HOME_FAQ.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
})

/** 08: questions in a sticky rail, answers as question/answer rows. */
export const Faq = () => (
  <Band id="faq" raised>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_JSON_LD }} />
    <Rail
      wide
      side={
        <>
          <Kicker num="08">FAQ</Kicker>
          <h2 className="mt-5.5 font-display text-[clamp(30px,3.2vw,46px)] leading-[.94] tracking-[-.012em] text-ink uppercase">Questions before you download</h2>
          <p className={`mt-4.5 ${NOTE}`}>Including the parts that are still missing.</p>
        </>
      }
    >
      <dl className="border-t border-line">
        {HOME_FAQ.map(({ question, answer }) => (
          <div key={question} className="grid grid-cols-1 gap-2.5 border-b border-line px-1 py-6.5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-7">
            <dt className="font-display text-[23px] leading-[1.06] text-ink uppercase">{question}</dt>
            <dd className="text-ink-dim body">{answer}</dd>
          </div>
        ))}
      </dl>
    </Rail>
  </Band>
)
