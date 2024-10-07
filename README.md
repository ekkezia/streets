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
