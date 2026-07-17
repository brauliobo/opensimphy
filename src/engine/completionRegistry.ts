import completionJson from "../../public/data/generated/completion.json";
import { parseCompletionReport } from "./completion.js";

export const completion = parseCompletionReport(completionJson);
