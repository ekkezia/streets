# Streets

`streets` is a collection of fashion story in the form of Google Street View-inspired user interface.

This project is planned to be conceived in different locations (Jakarta, Hong Kong (TBC)) and each has their own narrative and characters. The main character or the model is equipped with a 360 camera, though the shots are controlled and taken remotely by me. Shots are taken every ten to twenty foot steps taken. The project integrally highlights the locations and emphasizes on the journey of the character as the story, making it less-fragmented compared to typical fashion editorial that usually relies on dramatic events happening in every shot.

The shots are then uploaded to a database, which is rendered on a frontend by texturing the 360 image on a 3D sphere (from the React Three Fiber library). This enables viewers to interact with the image in the ways traditional fashion editorials are unable to. Viewers could rotate around to see the perspective of the character and catch a glimpse of the details happening in the background of each street. Similar to Google Street View, clickable arrows become an interface for the user to move along the streets and ultimately experience the story chronologically. These arrows are also custom coded to match with the real directions according to the streets.

## Frameworks & Libraries Used
1. Next.js
2. @react-three/fiber
3. @react-three/drei

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Optional env var for mode controls (mode selector, fullscreen button, orb controller):

```bash
REACT_APP_SHOW_MODE=true
```

Set `REACT_APP_SHOW_MODE=false` in production.

Media is served from a public Cloudflare R2 bucket. Set its public custom domain
or `r2.dev` URL without an object path:

```bash
NEXT_PUBLIC_R2_PUBLIC_URL=https://media.example.com
```

Without this variable, storage URLs use relative paths.

Media objects are expected at the bucket root by default. For example:

```text
streets_nyc_190426/streets_nyc_190426_1.mp4
```

If your bucket stores objects below a shared prefix, set it separately:

```bash
NEXT_PUBLIC_R2_STORAGE_ROOT=streets
```

The R2 bucket also needs a CORS policy for the app origin, because the 360
renderer loads media through browser fetch/video APIs. Update
`cloudflare-r2-cors.example.json` with the production domain, then apply it:

```bash
npx wrangler r2 bucket cors set <BUCKET_NAME> --file cloudflare-r2-cors.example.json
npx wrangler r2 bucket cors list <BUCKET_NAME>
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
