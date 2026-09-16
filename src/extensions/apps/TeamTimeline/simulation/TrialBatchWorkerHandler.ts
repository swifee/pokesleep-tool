/**
 * TrialBatchWorkerHandler.ts
 * Worker-side request handling, kept free of `self` so the same code can be
 * driven by a fake worker in tests and by the real worker entry point.
 */

import { runTrialBatchAsync } from "./MultiTrialSimulator";
import {
	deserializeTrialSimulationInput,
	type TrialBatchRequest,
	type TrialBatchResponse,
} from "./TrialBatchProtocol";

type RunRequest = Extract<TrialBatchRequest, { type: "run" }>;

/**
 * Build a request handler that posts its responses through `post`.
 *
 * One "run" request = one contiguous range of seeds. The batch yields to the
 * event loop between trials (runTrialBatchAsync), which is what lets a "stop"
 * request be processed mid-batch; the handler then posts the trials completed
 * so far, matching the partial-result behaviour of the in-thread runner.
 */
export function createTrialBatchHandler(
	post: (message: TrialBatchResponse) => void,
): (request: TrialBatchRequest) => void {
	const stopRequestedJobIds = new Set<number>();

	async function runJob(request: RunRequest): Promise<void> {
		const { jobId, seeds, previewFirstTrial } = request;
		try {
			const input = deserializeTrialSimulationInput(request.input);
			const { trials, state } = await runTrialBatchAsync(input, seeds, {
				shouldStop: () => stopRequestedJobIds.has(jobId),
				onTrialComplete: ({ index, seed, result }) => {
					if (index === 0 && previewFirstTrial) {
						post({ type: "preview", jobId, seed, result });
					}
				},
				onProgress: (completed) => {
					post({ type: "progress", jobId, completed });
				},
			});
			post({ type: "done", jobId, trials, state });
		} catch (error) {
			post({ type: "error", jobId, message: String(error) });
		} finally {
			stopRequestedJobIds.delete(jobId);
		}
	}

	return (request) => {
		if (request.type === "stop") {
			stopRequestedJobIds.add(request.jobId);
			return;
		}
		void runJob(request);
	};
}
