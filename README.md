Voxly is a [Next.js](https://nextjs.org) app for authenticated audio uploads, transcription processing, and AI-assisted insights. It uses Next.js App Router, API routes, Prisma for data access, and external AI/transcription services.

## Architecture

```mermaid
flowchart LR
	U[User Browser] -->|Auth & UI| APP[Next.js App Router]
	APP -->|API calls| API[Next.js API Routes]

	subgraph Core Services
		API -->|Auth| AUTH[NextAuth]
		API -->|DB| DB[(Postgres via Prisma)]
		API -->|Storage| S3[(S3-compatible Storage)]
		API -->|Transcription| DG[Deepgram]
		API -->|LLM| LLM[OpenAI/Gemini]
	end

	S3 -->|Audio files| API
	DG -->|Transcripts| API
	LLM -->|Summaries/Insights| API
	DB -->|Metadata & Users| API
```

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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
