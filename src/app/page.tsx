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
    <div className="space-y-4 px-4 md:px-8 lg:px-16">
      <div className="mt-24 space-y-2 text-center">
        <h1 className="text-lg font-semibold leading-tight tracking-tight md:text-2xl lg:text-3xl">
          ANALISIS PENERAPAN REAL-TIME NOISE SUPPRESSION PEER-TO-PEER WEBRTC
          DENGAN METODE PRE-TRAINED DTLN (DUAL-SIGNAL TRANSFORMATION LSTM
          NETWORK)
        </h1>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/dataset"
          >
            Dataset
          </Link>
          <Link
            className={buttonVariants({ variant: "default" })}
            href="/eksperimen"
          >
            Eksperimen
          </Link>
        </div>
      </div>

      <Accordion type="multiple" className="w-full">
        <AccordionItem value="rumusan-masalah" id="rumusan-masalah">
          <AccordionTrigger className="text-base font-medium hover:no-underline">
            Rumusan Masalah
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Distinctio
            dicta quam rem perferendis, molestiae labore dolorem optio debitis
            itaque quibusdam.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="batasan-masalah" id="batasan-masalah">
          <AccordionTrigger className="text-base font-medium hover:no-underline">
            Batasan Masalah
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
            Lorem ipsum dolor, sit amet consectetur adipisicing elit. Eaque
            optio adipisci repellendus neque rerum ab doloremque impedit? Est
            tenetur aliquam iste molestiae dolores. Sequi exercitationem
            inventore similique omnis iure dolorum molestias maiores veniam
            quidem saepe nisi, eos voluptates?
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tujuan" id="tujuan">
          <AccordionTrigger className="text-base font-medium hover:no-underline">
            Tujuan
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Officia
            tempora, ipsam voluptas labore nostrum dolore temporibus
            necessitatibus ipsa ad pariatur!
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="manfaat" id="manfaat">
          <AccordionTrigger className="text-base font-medium hover:no-underline">
            Manfaat
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Magni
            aliquam hic quo sit consequatur repellendus sequi. Quam sapiente
            nemo suscipit.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
