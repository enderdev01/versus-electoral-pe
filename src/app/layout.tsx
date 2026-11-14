import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";
import { MunicipalBanner } from "@/components/MunicipalBanner";
import { FooterApoyanos } from "@/components/FooterApoyanos";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { EleccionSwitch } from "@/components/EleccionSwitch";
import { isProductionAnalyticsEnvironment } from "@/lib/analytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = `${SITE_NAME} — Candidatos a Alcalde de Lima 2026`;
const analyticsEnabled = isProductionAnalyticsEnvironment({
  nodeEnv: process.env.NODE_ENV,
  vercelEnv: process.env.VERCEL_ENV,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#030712",
};

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: SITE_URL,
    languages: {
      "x-default": SITE_URL,
      es: SITE_URL,
      "es-PE": SITE_URL,
    },
  },
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon.png`,
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: "es",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: SITE_URL,
      name: TITLE,
      description: SITE_DESCRIPTION,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "es",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-white`}
      >
        <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
        {analyticsEnabled ? <GoogleAnalytics /> : null}
        <header className="sticky top-0 z-50 border-b border-gray-800/80 bg-gray-950/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link prefetch={false} href="/" className="flex items-center gap-1.5 group shrink-0">
              <span className="text-lg sm:text-xl font-black text-red-500 uppercase tracking-wider group-hover:text-red-400 transition-colors">
                Versus
              </span>
              <span className="hidden sm:inline text-lg sm:text-xl font-black text-white uppercase tracking-wider">
                Electoral Perú
              </span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Support link from sm up; on mobile it stays in the footer so the header never overflows */}
              <Link
                prefetch={false}
                href="/apoyanos"
                data-analytics-cta="support"
                data-analytics-location="header"
                className="hidden min-h-9 sm:inline-flex items-center gap-1.5 rounded-full border border-red-500/40 px-3 text-xs font-bold uppercase tracking-wider text-red-400 transition-[color,border-color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:border-red-400 [@media(hover:hover)_and_(pointer:fine)]:hover:text-red-300 active:scale-[0.97]"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 21s-6.7-4.35-9.33-8.1C.6 9.9 2.1 5.5 6.06 5.05 8.2 4.8 9.86 6 12 8.1c2.14-2.1 3.8-3.3 5.94-3.05 3.96.45 5.46 4.85 3.39 7.85C18.7 16.65 12 21 12 21z" />
                </svg>
                Apóyanos
              </Link>
              <EleccionSwitch />
            </div>
          </div>
        </header>
        <MunicipalBanner />
        <main id="main-content" tabIndex={-1}>{children}</main>
        <footer className="border-t border-gray-800/80 bg-gray-950/80 backdrop-blur-md text-gray-600">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
            {/* Mobile: solo branding + apóyanos compacto */}
            <div className="sm:hidden flex flex-col items-center text-center gap-4">
              <Link prefetch={false} href="/" className="flex items-center gap-1.5 group">
                <span className="text-base font-black text-red-500 uppercase tracking-wider group-hover:text-red-400 transition-colors">
                  Versus
                </span>
                <span className="text-base font-black text-white uppercase tracking-wider">
                  Electoral Perú
                </span>
              </Link>
              <p className="text-[11px] text-gray-400 leading-relaxed max-w-xs">
                Información de fuentes periodísticas públicas. Las clasificaciones son automáticas y no constituyen juicio legal.
              </p>
              <FooterApoyanos />
            </div>

            {/* Desktop: 3 columnas */}
            <div className="hidden sm:grid sm:grid-cols-3 gap-8">
              {/* Col 1 - Versus Electoral Perú */}
              <div>
                <Link prefetch={false} href="/" className="flex items-center gap-1.5 group mb-4">
                  <span className="text-base font-black text-red-500 uppercase tracking-wider group-hover:text-red-400 transition-colors">
                    Versus
                  </span>
                  <span className="text-base font-black text-white uppercase tracking-wider">
                    Electoral Perú
                  </span>
                </Link>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Información recopilada de fuentes periodísticas públicas. Las clasificaciones son automáticas y no constituyen juicio legal.
                </p>
                <p className="mt-2 text-[11px] text-gray-400">
                  Actualización automática dos veces al día (00:00 y 12:00, hora Perú).
                </p>
              </div>

              {/* Col 2 - Navegación */}
              <div className="flex justify-center">
                <div>
                  <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-4">
                    Navegación
                  </h4>
                  <ul className="space-y-2.5">
                    <li>
                      <Link prefetch={false} href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
                        Inicio
                      </Link>
                    </li>
                    <li>
                      <Link prefetch={false} href="/alcaldes/versus" className="text-sm text-gray-400 hover:text-white transition-colors">
                        Versus
                      </Link>
                    </li>
                    <li>
                      <Link prefetch={false} href="/alcaldes" className="text-sm text-gray-400 hover:text-white transition-colors">
                        Candidatos
                      </Link>
                    </li>
                    <li>
                      <Link prefetch={false} href="/#faq" className="text-sm text-gray-400 hover:text-white transition-colors">
                        Preguntas Frecuentes
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Col 3 - Apóyanos */}
              <div>
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-3">
                  Haz la diferencia
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">
                  Somos 100% independientes. Tu apoyo mantiene viva la transparencia electoral.
                </p>
                <FooterApoyanos />
              </div>
            </div>
          </div>

          {/* Barra inferior - Derechos reservados */}
          <div className="pb-5">
            <p className="text-center text-[11px] text-gray-600">
              © {new Date().getFullYear()} {SITE_NAME}. Todos los derechos reservados — Hecho por{" "}
              <a href="https://www.onilabs.site/" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-400 font-semibold transition-colors">
                OniLabs
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
