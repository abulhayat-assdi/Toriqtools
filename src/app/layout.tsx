import type { Metadata } from "next";
import "./globals.css";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/constants";
import { readFile } from "fs/promises";
import { join } from "path";
import { Suspense } from "react";
import RouteChangeTracker from "@/components/analytics/RouteChangeTracker";

export const dynamic = "force-dynamic";

async function getLogoVersion(): Promise<number> {
  try {
    const content = await readFile(
      join(process.cwd(), "public", "uploads", "logo-version.json"),
      "utf8"
    );
    return JSON.parse(content).v ?? 1;
  } catch {
    return 1;
  }
}

/** Version of the separately uploaded browser icon, or null if none uploaded (falls back to the logo). */
async function getFaviconVersion(): Promise<number | null> {
  try {
    const content = await readFile(
      join(process.cwd(), "public", "uploads", "favicon-version.json"),
      "utf8"
    );
    return JSON.parse(content).v ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  let data = null;
  try {
    data = await prisma.siteSettings.findUnique({
      where: { id: 1 },
      select: { site_name: true, site_tagline: true, meta_description: true },
    });
  } catch {
    // DB unreachable at build time — fall back to static defaults
  }

  const logoVersion = await getLogoVersion();
  const logoUrl = `/logo.png?v=${logoVersion}`;
  const faviconVersion = await getFaviconVersion();
  const iconUrl = faviconVersion ? `/favicon.png?v=${faviconVersion}` : logoUrl;

  const siteName = data?.site_name || "Toriq Tools";
  const tagline = data?.site_tagline || "Best Quality Tools in Bangladesh";
  const description =
    data?.meta_description ||
    "Toriq Tools — quality, durability and trust. Shop hand tools, power tools, cutting, measuring, ceramic and woodworking tools with cash on delivery across Bangladesh.";

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      template: `%s | ${siteName}`,
      default: `${siteName} | ${tagline}`,
    },
    description,
    icons: { icon: iconUrl, apple: iconUrl },
    openGraph: {
      title: `${siteName} | ${tagline}`,
      description,
      url: SITE_URL,
      siteName,
      images: [{ url: logoUrl, width: 800, height: 600, alt: siteName }],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${siteName} | ${tagline}`,
      description,
      images: [logoUrl],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const logoVersion = await getLogoVersion();
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Toriq Tools",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png?v=${logoVersion}`,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: ["English", "Bengali"],
    },
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Toriq Tools",
    url: SITE_URL,
  };

  return (
    <html lang="en" style={{ scrollBehavior: "smooth" }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Hind+Siliguri:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Google Tag Manager — inline script required; @next/third-parties not installed */}
        {/* eslint-disable-next-line @next/next/next-script-for-ga */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-K7PQDH2B');`,
          }}
        />
        {/* End Google Tag Manager */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="bg-white text-foreground antialiased min-h-screen flex flex-col" style={{ fontFamily: "'Poppins', 'Hind Siliguri', system-ui, sans-serif" }}>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-K7PQDH2B"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        {children}
        <Suspense fallback={null}>
          <RouteChangeTracker />
        </Suspense>
      </body>
    </html>
  );
}
