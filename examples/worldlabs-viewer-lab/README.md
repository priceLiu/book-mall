# worldlabs-viewer-lab

Minimal standalone WorldLabs viewer for debugging final render quality.

## Run

```bash
cd examples/worldlabs-viewer-lab
npm start
```

Open <http://localhost:3016/>.

## Usage

1. Paste your `WLT-Api-Key`.
2. Click `List Worlds` or paste a `world_id`.
3. Click `Open World`.
4. Switch quality between `full_res / 500k / 100k`.

This project intentionally has no auth/session management and follows the official examples flow:

- fetch world via `GET /marble/v1/worlds/{world_id}`
- load `assets.splats.spz_urls` in `SplatLoader`
- render with Spark + Three
