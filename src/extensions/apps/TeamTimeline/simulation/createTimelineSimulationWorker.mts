/**
 * Creates a Worker that runs TeamTimeline trial batches
 * (see timelineSimulation.worker.ts).
 *
 * Kept in its own .mts file for the same reason as
 * src/util/Team/createTeamSimulationWorker.mts: `import.meta.url` requires an
 * ES module, while the rest of the app type-checks as CommonJS per
 * package.json (.mts always type-checks as ESM regardless of that setting).
 */
export function createTimelineSimulationWorker(): Worker {
	return new Worker(
		new URL("./timelineSimulation.worker.ts", import.meta.url),
		{ type: "module" },
	);
}
