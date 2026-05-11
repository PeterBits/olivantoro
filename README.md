# Olivantoro — Editorial Web

Autocaravana rental website for **Olivantoro**, based in Toro, Zamora (Spain). Editorial style: serif display type, tight typographic hierarchy, calm surface palette.

Built with Astro 6 and deployed on Vercel.

## Tech Stack

- Astro 6 with server-side rendering (`output: 'server'`)
- No adapter needed (static output)
- Vanilla CSS with custom properties (no Tailwind)
- Google Fonts (serif display + sans body)
- Google Calendar integration via public API key
- TypeScript with `astro check` available

## Project Structure

```text
public/
  assets/                  # Van photos served as static files
src/
  env.d.ts                 # Astro / ImportMetaEnv type declarations
  layouts/
    BaseLayout.astro       # Base HTML layout, header/footer slots
  components/
    Header.astro           # Top nav
    Footer.astro           # Brand, WhatsApp and Instagram links
    Hero.astro             # Full-bleed hero with van photo and CTA
    VanInfo.astro          # Specs + equipment + interior photo
    Gallery.astro          # Photo gallery
    HowItWorks.astro       # 4-step booking process explainer
    BookingCalendar.astro  # Interactive availability calendar + WhatsApp CTA
  data/
    van-data.json          # Specs and equipment data
  styles/
    global.css             # Tokens, reset, typography, utilities
  pages/
    index.astro            # Single home page (full conversion funnel)
    api/
      availability.ts      # Returns availability from Google Calendar
```

## Page Structure

The home page is a single conversion funnel:

1. **Hero** — hook + "Consultar disponibilidad" CTA (scrolls to calendar)
2. **VanInfo** — technical specs and equipment
3. **Gallery** — photo gallery
4. **HowItWorks** — 4-step booking process
5. **BookingCalendar** — availability calendar + reserve via WhatsApp

## Design System

Editorial / professional theme:

| Token                     | Value              |
| :------------------------ | :----------------- |
| `--surface`               | Soft off-white     |
| `--surface-container`     | Neutral container  |
| `--on-surface`            | Deep text          |
| `--on-surface-variant`    | Muted text         |
| `--primary`               | Brand CTA          |
| `--tertiary`              | Eyebrow / labels   |
| `--outline`               | Borders            |

Typography pairs a serif family for display/italic accents with a sans-serif for body copy. Fluid sizing via `clamp()`. Mobile-first responsive layout with breakpoints at 768px and 1024px.

## Routes

| Path                | Description                        |
| :------------------ | :--------------------------------- |
| `/`                 | Home (full funnel + calendar)      |
| `/api/availability` | JSON availability from Google Cal  |

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. Declared types live in `src/env.d.ts`.

| Variable                 | Purpose                                                 |
| :----------------------- | :------------------------------------------------------ |
| `GOOGLE_CALENDAR_ID`     | Calendar ID (usually `xxxx@group.calendar.google.com`)  |
| `GOOGLE_API_KEY`         | Google Calendar API key with Calendar read access       |
| `PUBLIC_WHATSAPP_NUMBER` | WhatsApp number in international format, no "+" or spaces (e.g. `34722185903`) |

Without the Google variables, the booking calendar renders an error state. The rest of the site works normally and funnels users to WhatsApp.

## Commands

| Command           | Action                                    |
| :---------------- | :---------------------------------------- |
| `npm install`     | Install dependencies                      |
| `npm run dev`     | Start local dev server at localhost:4321  |
| `npm run build`   | Build for production                      |
| `npm run preview` | Preview the production build locally      |
| `npm run check`   | Run `astro check` for TypeScript errors   |

## Deployment

Deployed on Vercel. Push the repository, connect it to Vercel and set the environment variables above in the project settings. Requires Node 22.12+ (declared in `package.json` `engines`).
