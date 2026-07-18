# Kochi Metro Side Quests

<p align="center">
  <img src="images/IMG_1315-2.png" alt="beautiful face" width="200">
</p>

## Google Maps setup

Create `.env.local` with:

```bash
GOOGLE_MAPS_KEY=your_google_maps_key
OPENAI_API_KEY=your_openai_api_key
```

Keep both keys in `.env.local`; never commit or expose them in client-side code.
The previously exposed OpenAI key must be revoked and replaced.

In Google Cloud Console, restrict the Maps key by API and website referrer:

- Enable only Maps JavaScript API, Places API, and Routes API.
- Allow your local development origin and exact production domain.
