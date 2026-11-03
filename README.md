# SpendWise Web

Standalone React, TypeScript, and Vite frontend for SpendWise.

## Local Development

1. Install Node.js 22 or later.
2. Copy `.env.example` to `.env` and set `VITE_API_URL` to the backend API base URL, including `/api/v1`.
3. Install dependencies and start the frontend:

```sh
npm ci
npm run dev
```

## Deploy On Vercel

Import this repository as a Vite project. Use the repository root as the project root, `npm ci` as the install command, `npm run build` as the build command, and `dist` as the output directory. `vercel.json` configures the SPA fallback.

Set `VITE_API_URL` in the Vercel project's environment variables to the deployed backend URL, for example `https://your-api.example.com/api/v1`, then redeploy. Also configure the backend's `CORS_ORIGIN` to the frontend's production origin.

## Scripts

- `npm run dev`: Start the local Vite server.
- `npm run build`: Type-check and create the production build in `dist/`.
- `npm run preview`: Preview the production build locally.
- `npm run lint`: Lint the frontend.

Do not commit `.env`; configure deployment values in Vercel's environment-variable settings.
