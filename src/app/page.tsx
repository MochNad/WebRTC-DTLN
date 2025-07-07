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
            IMPLEMENTASI REAL-TIME NOISE SUPPRESSION PADA KOMUNIKASI
            PEER-TO-PEER WEBRTC MENGGUNAKAN METODE PRE-TRAINED DTLN (DUAL-SIGNAL
            TRANSFORMATION LSTM NETWORK)
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
                    Rumusan masalah penelitian ini adalah:
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-8 pb-8">
              <div className="pl-18 space-y-4">
                <ol className="text-muted-foreground text-lg leading-relaxed space-y-3 list-decimal list-inside">
                  <li>
                    Bagaimana merancang dan membangun sistem real-time noise
                    suppression pada komunikasi WebRTC dengan menerapkan metode
                    pre-trained DTLN?
                  </li>
                  <li>
                    Bagaimana menguji performa sistem yang telah dibangun untuk
                    membuktikan bahwa metode DTLN efektif dalam meningkatkan
                    kualitas audio pada komunikasi WebRTC?
                  </li>
                </ol>
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
                    Ruang lingkup permasalahan pada penelitian ini didasarkan
                    pada:
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-8 pb-8">
              <div className="pl-18 space-y-4">
                <ol className="text-muted-foreground text-lg leading-relaxed space-y-3 list-decimal list-inside">
                  <li>
                    Penggunaan WebRTC peer-to-peer untuk komunikasi real-time
                    dengan dua client yang saling terhubung.
                  </li>
                  <li>
                    Implementasi model pre-trained DTLN yang telah disediakan di
                    repository GitHub DTLN tanpa pelatihan ulang.
                  </li>
                  <li>
                    Pengujian dilakukan menggunakan audio file rekaman yang
                    diproses secara real-time dan dikirimkan ke client lainnya.
                  </li>
                  <li>Penggunaan browser dan Next.js dalam pengujian.</li>
                </ol>
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
                    Tujuan dari dilakukannya skripsi ini adalah sebagai berikut:
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-8 pb-8">
              <div className="pl-18 space-y-4">
                <ol className="text-muted-foreground text-lg leading-relaxed space-y-3 list-decimal list-inside">
                  <li>
                    Mengimplementasikan metode pre-trained DTLN untuk membangun
                    sebuah sistem yang mampu menekan noise secara real-time
                    dalam aplikasi komunikasi peer-to-peer WebRTC.
                  </li>
                  <li>
                    Melakukan pengujian untuk mengukur dan menganalisis
                    kemampuan sistem dalam mengurangi noise serta meningkatkan
                    kualitas audio, sebagai bukti keberhasilan implementasi.
                  </li>
                </ol>
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
                    Hasil penelitian ini diharapkan akan memberikan manfaat:
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-8 pb-8">
              <div className="pl-18 space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-foreground">
                    Untuk Peneliti
                  </h3>
                  <ol className="text-muted-foreground text-lg leading-relaxed space-y-3 list-decimal list-inside">
                    <li>
                      Memperoleh pemahaman yang mendalam tentang penerapan model
                      DTLN dalam meningkatkan kualitas suara dalam komunikasi
                      real-time berbasis WebRTC.
                    </li>
                    <li>
                      Mengembangkan keterampilan dalam implementasi dan
                      pengujian teknologi jaringan saraf untuk pemrosesan audio.
                    </li>
                    <li>
                      Menyumbangkan pengetahuan baru yang dapat digunakan
                      sebagai referensi untuk penelitian selanjutnya dalam
                      bidang komunikasi real-time dan pemrosesan sinyal audio.
                    </li>
                  </ol>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-foreground">
                    Untuk Politeknik
                  </h3>
                  <ol className="text-muted-foreground text-lg leading-relaxed space-y-3 list-decimal list-inside">
                    <li>
                      Menyediakan bukti empiris dan studi kasus yang dapat
                      digunakan untuk meningkatkan kurikulum di bidang teknologi
                      informasi dan komunikasi.
                    </li>
                    <li>
                      Menambah wawasan dan literatur ilmiah di perpustakaan
                      politeknik terkait teknologi WebRTC dan jaringan saraf
                      untuk pemrosesan audio.
                    </li>
                    <li>
                      Memperkuat reputasi akademik politeknik dengan kontribusi
                      penelitian yang relevan dan terkini.
                    </li>
                  </ol>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-foreground">
                    Untuk Pembaca
                  </h3>
                  <ol className="text-muted-foreground text-lg leading-relaxed space-y-3 list-decimal list-inside">
                    <li>
                      Memberikan informasi dan pengetahuan tentang penggunaan
                      teknologi jaringan saraf untuk penekanan kebisingan dalam
                      komunikasi real-time.
                    </li>
                    <li>
                      Menyediakan wawasan tentang tantangan dan solusi dalam
                      meningkatkan kualitas audio dalam komunikasi berbasis
                      WebRTC.
                    </li>
                    <li>
                      Menjadi referensi berguna bagi pembaca yang tertarik atau
                      bekerja di bidang komunikasi digital, pemrosesan sinyal,
                      dan teknologi jaringan saraf.
                    </li>
                  </ol>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
