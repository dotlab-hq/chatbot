import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora, Onest, Reddit_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersonalizationApplier } from "@/components/personalization-applier";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://chat.vercel.ai"),
  title: "Next.js Chatbot Template",
  description: "Next.js chatbot template using the AI SDK.",
};

export const viewport = {
  maximumScale: 1,
};

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sora",
});

const onest = Onest({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-onest",
});

const redditMono = Reddit_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-reddit-mono",
});

const LIGHT_THEME_COLOR = "hsl(0 0% 100%)";
const DARK_THEME_COLOR = "hsl(240deg 10% 3.92%)";
const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;

const PERSONALIZE_SCRIPT = `(function(){
  try {
    var t=localStorage.getItem('personalize-theme')||'modern';
    var f=localStorage.getItem('personalize-font')||'sora';
    var fs=localStorage.getItem('personalize-font-size')||'m';
    var sp=localStorage.getItem('personalize-spacing')||'compact';
    var av=localStorage.getItem('personalize-avatars')!=='0';
    var h=document.documentElement;
    h.classList.add('theme-'+t,'font-'+f);
    var w=document.getElementById('personalize-root');
    if(w){w.classList.add('text-size-'+fs,'spacing-'+sp);if(!av)w.classList.add('hide-avatars');}
  }catch(e){}
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${geist.variable} ${geistMono.variable} ${sora.variable} ${onest.variable} ${redditMono.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: "Required"
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: "Required"
          dangerouslySetInnerHTML={{
            __html: PERSONALIZE_SCRIPT,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <TooltipProvider>
            <div id="personalize-root">
              <PersonalizationApplier />
              {children}
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
