# Weather App (Next.js)

This is a simple weather application built with **Next.js (App Router)**.  
It fetches **live weather data** using the [Open-Meteo API](https://open-meteo.com/) (no API key required).

## Features
- Search weather by **City, Town, ZIP/Postal Code, Landmark, or Latitude/Longitude**
- **Autosuggestions** while typing
- **Use My Location** (via browser geolocation)
- **Current weather**: temperature, feels-like, humidity, wind, precipitation, etc.
- **5-day forecast** with daily highs/lows and conditions
- Toggle between **Metric and Imperial units**
- Runs fully client-side, no backend setup needed

## Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/your-username/weather-next.git
cd weather-next
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run the development server
```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure
```
app/
 ├─ layout.tsx    # Root layout
 └─ page.tsx      # Main weather app UI
```

## Tech Stack
- [Next.js](https://nextjs.org/) 13+ (App Router)
- [React](https://react.dev/)
- [TailwindCSS](https://tailwindcss.com/) for quick styling
- [Open-Meteo API](https://open-meteo.com/) for live weather + geocoding

## Notes
- No API keys required — free & anonymous public API.
- This project focuses on functionality. UI/UX can be enhanced by a designer.
