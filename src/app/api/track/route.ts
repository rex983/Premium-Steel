import { auth } from "@/auth";
import { handleTrack } from "@/lib/launcher-kit/track";

// Office analytics: page views + clicks from <Tracker /> (launcher kit).
export async function POST(req: Request) {
  return handleTrack(req, await auth());
}
