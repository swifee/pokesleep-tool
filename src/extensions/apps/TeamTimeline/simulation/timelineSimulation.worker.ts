/**
 * timelineSimulation.worker.ts
 * Web Worker entry point that runs TeamTimeline trial batches off the main
 * thread. All logic lives in TrialBatchWorkerHandler; this file only wires
 * it to the worker message port.
 */

import type {
	TrialBatchRequest,
	TrialBatchResponse,
} from "./TrialBatchProtocol";
import { createTrialBatchHandler } from "./TrialBatchWorkerHandler";

// Type-checked against the "dom" lib (tsconfig.worker.json) like
// src/util/Team/teamSimulation.worker.ts, because the simulation modules
// transitively reference DOM-only globals in code paths this worker never
// runs (e.g. localStorage in buildStrengthParameterFromTimelineBonusSettings,
// which is why the StrengthParameter arrives pre-built in the request).
declare const self: {
	postMessage(message: TrialBatchResponse): void;
	addEventListener(
		type: "message",
		listener: (event: MessageEvent<TrialBatchRequest>) => void,
	): void;
};

const handleRequest = createTrialBatchHandler((message) => {
	self.postMessage(message);
});

self.addEventListener("message", (event: MessageEvent<TrialBatchRequest>) => {
	handleRequest(event.data);
});
