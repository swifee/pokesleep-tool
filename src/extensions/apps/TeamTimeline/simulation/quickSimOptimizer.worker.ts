/**
 * quickSimOptimizer.worker.ts
 * 起用率最適化の候補をバックグラウンドで評価する Web Worker。
 * 最初に "init" で評価器の文脈を受け取り、以後の "evaluate" をその文脈で処理する。
 */

import { QuickSimEvaluator } from "./QuickSimEvaluator";
import {
	deserializeQuickSimEvaluatorContext,
	type QuickSimOptimizerWorkerRequest,
	type QuickSimOptimizerWorkerResponse,
} from "./QuickSimOptimizerWorkerProtocol";

// This file is type-checked against the "dom" lib (see tsconfig.worker.json)
// rather than "webworker", because it transitively imports modules that
// reference DOM-only globals (e.g. localStorage) unrelated to this worker's
// own logic. `self` is narrowed locally to the subset of the dedicated
// worker API this file actually uses.
declare const self: {
	postMessage(message: QuickSimOptimizerWorkerResponse): void;
	addEventListener(
		type: "message",
		listener: (event: MessageEvent<QuickSimOptimizerWorkerRequest>) => void,
	): void;
};

/** 進捗を送る最短間隔 */
const PROGRESS_INTERVAL_MS = 100;

let evaluator: QuickSimEvaluator | null = null;

function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

self.addEventListener(
	"message",
	(event: MessageEvent<QuickSimOptimizerWorkerRequest>) => {
		const request = event.data;
		if (request.type === "init") {
			try {
				evaluator = new QuickSimEvaluator(
					deserializeQuickSimEvaluatorContext(request.context),
				);
				self.postMessage({ type: "ready" });
			} catch (error) {
				self.postMessage({
					type: "error",
					requestId: null,
					message: toErrorMessage(error),
				});
			}
			return;
		}
		if (evaluator === null) {
			self.postMessage({
				type: "error",
				requestId: request.requestId,
				message: "Worker is not initialized",
			});
			return;
		}
		try {
			let lastProgressAt = Date.now();
			const evaluations = evaluator.evaluateSync(
				request.candidates,
				request.seeds,
				request.options,
				(completed, total) => {
					const now = Date.now();
					if (
						completed < total &&
						now - lastProgressAt < PROGRESS_INTERVAL_MS
					) {
						return;
					}
					lastProgressAt = now;
					self.postMessage({
						type: "progress",
						requestId: request.requestId,
						completed,
						total,
					});
				},
			);
			self.postMessage({
				type: "result",
				requestId: request.requestId,
				evaluations,
			});
		} catch (error) {
			self.postMessage({
				type: "error",
				requestId: request.requestId,
				message: toErrorMessage(error),
			});
		}
	},
);
