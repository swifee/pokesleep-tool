/**
 * Creates a Worker that evaluates quick sim optimizer candidates
 * (see quickSimOptimizer.worker.ts).
 *
 * Kept in its own .mts file for the same reason as
 * src/util/Team/createTeamSimulationWorker.mts: `import.meta.url` requires an
 * ES module, while the rest of the app type-checks as CommonJS.
 */
export function createQuickSimOptimizerWorker(): Worker {
	return new Worker(new URL("./quickSimOptimizer.worker.ts", import.meta.url), {
		type: "module",
	});
}
