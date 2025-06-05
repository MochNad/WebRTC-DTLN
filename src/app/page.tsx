import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-12">
        {/* Hero Section - Title Outside Card */}
        <div className="mt-8 space-y-6 text-center">
          <h1 className="text-xl font-bold leading-tight tracking-tight md:text-2xl lg:text-3xl">
            ANALISIS PENERAPAN REAL-TIME NOISE SUPPRESSION PEER-TO-PEER WEBRTC
            ANALISIS PENERAPAN REAL-TIME NOISE SUPPRESSION PEER-TO-PEER WEBRTC
            DENGAN METODE PRE-TRAINED DTLN (DUAL-SIGNAL TRANSFORMATION LSTM
            NETWORK)
          </h1>
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            className={buttonVariants({ variant: "outline", size: "lg" })}
            href="/dataset"
          >
            Dataset
          </Link>
          <Link
            className={buttonVariants({ variant: "default", size: "lg" })}
            href="/eksperimen"
          >
            Eksperimen
          </Link>
        </div>

        {/* Research Overview Accordion */}
        <Accordion type="multiple" className="w-full">
          {/* Section 1: Rumusan Masalah */}
          <AccordionItem value="rumusan-masalah" className="border-b-0">
            <AccordionTrigger className="px-8 py-6 hover:no-underline">
              <div className="flex items-center gap-6 w-full">
                <div className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full font-bold text-xl shrink-0">
                  1
                </div>
                <div className="text-left">
                  <h2 className="text-2xl font-bold tracking-tight">
                    Rumusan Masalah
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Identifikasi permasalahan dalam penelitian
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-8 pb-8">
              <div className="pl-18">
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Lorem ipsum dolor sit amet consectetur adipisicing elit.
                  Distinctio dicta quam rem perferendis, molestiae labore
                  dolorem optio debitis itaque quibusdam. Necessitatibus
                  corporis vel perspiciatis minima assumenda sint quaerat
                  numquam eligendi.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 2: Batasan Masalah */}
          <AccordionItem value="batasan-masalah" className="border-b-0">
            <AccordionTrigger className="px-8 py-6 hover:no-underline">
              <div className="flex items-center gap-6 w-full">
                <div className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full font-bold text-xl shrink-0">
                  2
                </div>
                <div className="text-left">
                  <h2 className="text-2xl font-bold tracking-tight">
                    Batasan Masalah
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ruang lingkup dan keterbatasan penelitian
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-8 pb-8">
              <div className="pl-18">
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Lorem ipsum dolor, sit amet consectetur adipisicing elit.
                  Eaque optio adipisci repellendus neque rerum ab doloremque
                  impedit? Est tenetur aliquam iste molestiae dolores. Sequi
                  exercitationem inventore similique omnis iure dolorum
                  molestias maiores veniam quidem saepe nisi, eos voluptates?
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 3: Tujuan */}
          <AccordionItem value="tujuan" className="border-b-0">
            <AccordionTrigger className="px-8 py-6 hover:no-underline">
              <div className="flex items-center gap-6 w-full">
                <div className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full font-bold text-xl shrink-0">
                  3
                </div>
                <div className="text-left">
                  <h2 className="text-2xl font-bold tracking-tight">Tujuan</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Target yang ingin dicapai dalam penelitian
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-8 pb-8">
              <div className="pl-18">
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Lorem ipsum dolor sit amet consectetur adipisicing elit.
                  Officia tempora, ipsam voluptas labore nostrum dolore
                  temporibus necessitatibus ipsa ad pariatur! Quod
                  exercitationem vel distinctio consectetur.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 4: Manfaat */}
          <AccordionItem value="manfaat" className="border-b-0">
            <AccordionTrigger className="px-8 py-6 hover:no-underline">
              <div className="flex items-center gap-6 w-full">
                <div className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full font-bold text-xl shrink-0">
                  4
                </div>
                <div className="text-left">
                  <h2 className="text-2xl font-bold tracking-tight">Manfaat</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Kegunaan dan dampak hasil penelitian
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-8 pb-8">
              <div className="pl-18">
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Lorem ipsum dolor sit amet consectetur adipisicing elit. Magni
                  aliquam hic quo sit consequatur repellendus sequi. Quam
                  sapiente nemo suscipit. Vel assumenda quaerat dignissimos
                  necessitatibus.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
