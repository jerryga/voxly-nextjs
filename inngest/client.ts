import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "voxly",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
