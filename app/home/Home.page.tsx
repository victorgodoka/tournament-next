import { Footer } from "@ui/footer";
import { Header } from "@ui/header";
import { AutomaticTournaments } from "./sections/AutomaticTournaments";
import { ClosingCta } from "./sections/ClosingCta";
import { DoubleScripts } from "./sections/DoubleScripts";
import { Faq } from "./sections/Faq";
import { FaqReasons } from "./sections/FaqReasons";
import { FixedBar } from "./sections/FixedSections";
import { Formats } from "./sections/Formats";
import { MainHero } from "./sections/MainHero";
import { MetaDecks } from "./sections/MetaDecks";
import { Modes } from "./sections/Modes";
import { Tools } from "./sections/Tools";
import { HOME_NAVBAR_ITEMS } from "@utils/const";

/** Landing: hero and format ticker, eight numbered bands, a closing call to action. */
const HomePage = () => (
  <>
    <Header items={HOME_NAVBAR_ITEMS} />
    <main className="relative flex w-full flex-col overflow-x-clip pb-19 sm:pb-0">
      <MainHero />
      <FaqReasons />
      <AutomaticTournaments />
      <DoubleScripts />
      <Formats />
      <MetaDecks />
      <Tools />
      <Modes />
      <Faq />
      <ClosingCta />
    </main>
    <Footer />
    <FixedBar />
  </>
)

export default HomePage;
