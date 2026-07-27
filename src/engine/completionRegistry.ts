import completionJson from "../../public/data/generated/completion.json";
import { parseCompletionReport } from "./completionReport.js";

export const completion = parseCompletionReport(completionJson);
