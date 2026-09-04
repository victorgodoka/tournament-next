"use client";
import { Modal } from "@components/ui";
import { Button } from "@components/ui/button/button.component";
import { useIsOffScreen } from "@hooks/index";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { Fragment, RefObject, useEffect, useState } from "react";
import { useModal } from "../../contexts";
import { FORMATS_SUPPORTED } from "@utils/const";

const Header = ({ elementRef }: { elementRef: RefObject<HTMLElement | null> }) => (
  <nav ref={elementRef} className="bg-omega-ink-black border-b border-[#F2EFE9] h-16 w-full flex flex-nowrap items-center justify-between absolute z-50 top-0 uppercase">
  <div className="hidden sm:flex flex-1 items-center gap-2 px-8 h-full border-r border-omega-faded">
    <Image className="w-auto" src="/logo.png" alt="YGO Omega Logo" width={30} height={30} />
    <h2 className="text-white font-display text-lg">YGO Omega</h2>
  </div>
  <div className="flex lg:hidden items-center gap-2 px-8 h-full cursor-pointer border-r border-omega-faded sm:border-none">
    <Icon icon="mdi:menu" />
  </div>
  <div><Button size="md">DOWNLOAD FREE</Button></div>
</nav>
)

const Footer = ({ isOffscreen }: { isOffscreen: boolean }) => isOffscreen && <aside className="bg-omega-ink-black xl:hidden border-t border-[#F2EFE9] w-full flex flex-nowrap items-center justify-between fixed z-50 bottom-0 p-4 uppercase">
  <div>
    <p className="text-lg font-display">every card unlocked</p>
    <p className="text-omega-gray-light font-mono text-xs">Install fast and free</p>
  </div>
  <div><Button size="sm">DOWNLOAD FREE</Button></div>
</aside>

const HomePage = () => {
  const { isOpen, toggleModal } = useModal()
  const [image, setImage] = useState<string | null>(null);
  const [elementRef, isOffScreen] = useIsOffScreen();

  useEffect(() => {
    toggleModal(!!image);

    () => {
      toggleModal(false);
      setImage(null)
    }
  }, [image])

  return (
    <>
      <Modal isOpen={isOpen} onClose={() => setImage(null)}>
        {image && <Image src={image} alt="Screenshot" width={1920} height={1080} />}
      </Modal>
      <Header elementRef={elementRef} />
      <main className="w-full flex flex-col bg-omega-ink-black pr-4 xl:pr-0 relative mb-24 xl:mb-0">
        <div className="pt-16 border-r flex-1 border-omega-faded xl:grid xl:grid-cols-[1fr_700px]">
          <article className="max-w-xl md:max-w-3xl w-full flex flex-col @container p-8 xl:h-dvh home-grid-left">
            <aside className="w-full flex items-center justify-between uppercase text-xs font-normal font-mono">
              <p className="text-omega-cyan flex-1">free. every card unlocked.</p>
              <div className="flex-1 bg-[#F2EFE9] opacity-18 h-px mx-2" />
              <p className="text-omega-gray-light flex-1">SINCE 2019 / DUELISTS UNITE</p>
            </aside>
            <div className="flex-1 py-8">
              <h1 className="text-5xl md:text-7xl font-bold flex flex-wrap space-x-1 sm:space-x-2 text-white text-shadow-2xs uppercase leading-[.95]">
                <span>The First</span>
                <span className="text-omega-cyan">Yu-Gi-Oh!</span>
                <span>Simulator With a</span>
                <span className="bg-omega-magenta text-omega-ink-black px-1 block @md:inline-flex @md:gap-1"><span>Real</span><br className="sm:hidden" /><span>Automatic</span></span>
                <span>Tournament System</span>
              </h1>
            </div>
            <aside className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pt-8 border-t border-omega-faded">
              <p className="text-lg text-omega-gray leading-relaxed">Official TCG and OCG rulings, every card unlocked, Elo ranking, and Swiss tournaments. No install beyond the launcher. Free.</p>
              <div className="flex flex-col gap-4">
                <div><Button className="text-lg sm:text-2xl" shadow={true}>CHECK OUR TOURNAMENTS</Button></div>
                <span className="text-omega-gray-light font-mono text-xs">TCG, Genesys, EDISON. All formats. Free.</span>
              </div>
            </aside>
          </article>
          <div className="grid grid-cols-2 grid-rows-[auto_auto_auto_1fr] xl:grid-rows-[auto_290_1fr] home-grid-right gap-0 mt-8 xl:mt-0">
            <div className="col-span-2 relative isolate">
              <Image onClick={() => setImage("/SCREEN_1.png")} className="cursor-pointero inset-0 object-cover opacity-62 col-span-2 bg-blend-color" width={1920} height={1080} src="/SCREEN_1.png" alt="Screenshot of a duel in YGO Omega" />
              <aside className="absolute top-0 left-0 -z-1 bg-omega-cyan w-full h-full" />
            </div>
            <div className="relative isolate overflow-hidden object-cover">
              <Image className="cursor-pointer w-full inset-0 object-cover opacity-62 col-span-2 bg-blend-color" width={480} height={480} src="https://ygopro.online/assets/card-arts/26077387.jpg" alt="Image of Sky Striker Raye" />
              <aside className="absolute top-0 w-full h-full left-0 -z-1 bg-omega-magenta" />
            </div>
            <div className="relative isolate overflow-hidden object-cover">
              <Image className="cursor-pointer w-full inset-0 object-cover opacity-62 col-span-2 bg-blend-color" width={480} height={480} src="https://ygopro.online/assets/card-arts/26077387.jpg" alt="Image of Sky Striker Raye" />
              <aside className="absolute top-0 w-full h-full left-0 -z-1 bg-omega-cyan" />
            </div>
            <div className="col-span-2 xl:col-span-1 py-4 px-8 border-l border-t border-omega-faded h-auto">
              <p className="font-display text-omega-cyan text-5xl">FREE</p>
              <span className="text-omega-gray-light font-mono text-xs">No currency, no crafting, no packs</span>
            </div>
            <div className="col-span-2 xl:col-span-1 py-4 px-8 border-l border-t border-omega-faded h-auto">
              <p className="font-display text-omega-cyan text-5xl">Rankeds Elo</p>
              <span className="text-omega-gray-light font-mono text-xs">A rating that moves with your results</span>
            </div>
          </div>
        </div>
        <aside className="overflow-hidden whitespace-nowrap w-full bg-omega-cyan border-t border-b border-omega-gray-light">
          <div className="flex w-max animate-marquee text-omega-ink-black font-display text-2xl h-16">
            {[0, 1].map(copy => (
              <div key={copy} aria-hidden={copy === 1} className="flex min-w-screen shrink-0 items-center justify-around gap-8 px-4">
                {FORMATS_SUPPORTED.map(format => <Fragment key={format}><span>{format}</span><span>/</span></Fragment>)}
              </div>
            ))}
          </div>
        </aside>
      </main>
      <Footer isOffscreen={isOffScreen} />
    </>
  )
}

export default HomePage;