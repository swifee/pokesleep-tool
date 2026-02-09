import { TimeSlot, clampSimulationDays, getDisplayLabel } from '../types/TimeSlotTypes';
import { parseTime, sortTimeSlots } from './TimeSlotUtils';

const DAY_BOUNDARY_MINUTES = 4 * 60;

export interface ExpandedTimelineSlot {
    slot: TimeSlot;
    originalSlotId: string;
    dayIndex: number;
    slotIndexInDay: number;
}

export interface DayBandMarker {
    afterDisplaySlotId: string;
    dayNumber: number;
}

export interface ExpandedTimeline {
    baseDaySlots: TimeSlot[];
    expandedSlots: ExpandedTimelineSlot[];
    dayBands: DayBandMarker[];
    slotsByDay: TimeSlot[][];
}

function buildBaseDaySlots(timeSlots: TimeSlot[]): TimeSlot[] {
    const sortedSlots = sortTimeSlots(timeSlots);
    const sleepSlot = timeSlots.find(slot => getDisplayLabel(slot) === 'sleep');
    if (!sleepSlot) {
        return sortedSlots;
    }

    const normalizedSlots = [...sortedSlots];
    const sleepIndex = normalizedSlots.findIndex(slot => slot.id === sleepSlot.id);
    if (sleepIndex > 0) {
        normalizedSlots.splice(sleepIndex, 1);
        normalizedSlots.unshift(sleepSlot);
    }

    const endSlot: TimeSlot = {
        ...sleepSlot,
        id: `${sleepSlot.id}-end`,
    };
    return [...normalizedSlots, endSlot];
}

function findDayBandAnchorIndex(baseDaySlots: TimeSlot[]): number {
    let anchorIndex = -1;
    for (let i = 0; i < baseDaySlots.length; i++) {
        if (parseTime(baseDaySlots[i].time) < DAY_BOUNDARY_MINUTES) {
            anchorIndex = i;
        }
    }
    return anchorIndex >= 0 ? anchorIndex : Math.max(baseDaySlots.length - 1, 0);
}

export function buildExpandedTimeline(timeSlots: TimeSlot[], simulationDays: number): ExpandedTimeline {
    const days = clampSimulationDays(simulationDays);
    const baseDaySlots = buildBaseDaySlots(timeSlots);
    const expandedSlots: ExpandedTimelineSlot[] = [];
    const slotsByDay: TimeSlot[][] = [];
    const dayBands: DayBandMarker[] = [];

    if (baseDaySlots.length === 0) {
        return {
            baseDaySlots,
            expandedSlots,
            dayBands,
            slotsByDay,
        };
    }

    const firstSlot = baseDaySlots[0];
    const hasSleepStartCopy =
        firstSlot !== undefined &&
        getDisplayLabel(firstSlot) === 'sleep' &&
        baseDaySlots.some(slot => slot.id === `${firstSlot.id}-end`);

    for (let dayIndex = 0; dayIndex < days; dayIndex++) {
        const sourceSlots = dayIndex > 0 && hasSleepStartCopy
            ? baseDaySlots.slice(1)
            : baseDaySlots;
        const daySlots: TimeSlot[] = [];
        for (let slotIndexInDay = 0; slotIndexInDay < sourceSlots.length; slotIndexInDay++) {
            const originalSlot = sourceSlots[slotIndexInDay];
            const displaySlotId = `${originalSlot.id}__day${dayIndex}`;
            const slot: TimeSlot = {
                ...originalSlot,
                id: displaySlotId,
            };
            daySlots.push(slot);
            expandedSlots.push({
                slot,
                originalSlotId: originalSlot.id,
                dayIndex,
                slotIndexInDay,
            });
        }
        slotsByDay.push(daySlots);

        if (dayIndex < days - 1) {
            const anchorIndex = findDayBandAnchorIndex(daySlots);
            dayBands.push({
                afterDisplaySlotId: daySlots[anchorIndex].id,
                dayNumber: dayIndex + 2,
            });
        }
    }

    return {
        baseDaySlots,
        expandedSlots,
        dayBands,
        slotsByDay,
    };
}
