export type SummaryValueMode = "periodTotal" | "dailyAverage";

function roundToSingleDecimal(value: number): number {
	return Math.round(value * 10) / 10;
}

export function resolveSummaryValueMode(
	mode: SummaryValueMode,
	simulationDays: number,
): SummaryValueMode {
	return simulationDays >= 2 ? mode : "periodTotal";
}

export function toSummaryModeValue(
	value: number,
	mode: SummaryValueMode,
	simulationDays: number,
): number {
	if (resolveSummaryValueMode(mode, simulationDays) === "dailyAverage") {
		return value / Math.max(simulationDays, 1);
	}
	return value;
}

export function formatSummaryNumber(value: number): string {
	const rounded = roundToSingleDecimal(value);
	if (Number.isInteger(rounded)) {
		return rounded.toLocaleString();
	}
	return rounded.toLocaleString(undefined, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
}

export function formatSummaryInteger(value: number): string {
	return Math.round(value).toLocaleString();
}

export function formatSummaryEp(value: number): string {
	return Math.round(value).toLocaleString();
}
