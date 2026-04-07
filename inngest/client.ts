import { Inngest } from "inngest";

function buildInngestEnvVars() {
  return {
    ...process.env,
    INNGEST_ENV: undefined,
    BRANCH_NAME: undefined,
    BRANCH: undefined,
    VERCEL_GIT_COMMIT_REF: undefined,
    CF_PAGES_BRANCH: undefined,
    RENDER_GIT_BRANCH: undefined,
    RAILWAY_GIT_BRANCH: undefined,
  };
}

export const inngest = new Inngest({
  id: "voxly",
  eventKey: process.env.INNGEST_EVENT_KEY,
}).setEnvVars(buildInngestEnvVars());
