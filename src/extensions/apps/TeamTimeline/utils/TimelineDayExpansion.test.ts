import { describe, expect, it } from 'vitest';
import { TimeSlot } from '../types/TimeSlotTypes';
import { buildExpandedTimeline } from './TimelineDayExpansion';

describe('buildExpandedTimeline', () => {
    it('2日目以降は先頭の就寝コピーを含めない', () => {
        const timeSlots: TimeSlot[] = [
            { id: 'sleep', time: '22:30', sleepState: 'sleep', hasMeal: false },
            { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
            { id: 'lunch', time: '12:00', sleepState: 'none', hasMeal: true },
        ];

        const expanded = buildExpandedTimeline(timeSlots, 2);
        const ids = expanded.expandedSlots.map(slot => slot.slot.id);

        expect(ids).toContain('sleep__day0');
        expect(ids).toContain('sleep-end__day0');
        expect(ids).toContain('wake__day1');
        expect(ids).toContain('sleep-end__day1');
        expect(ids).not.toContain('sleep__day1');
    });

    it('日付帯は各日のAM4:00より前の最後セルの直後に配置される', () => {
        const timeSlots: TimeSlot[] = [
            { id: 'sleep', time: '23:00', sleepState: 'sleep', hasMeal: false },
            { id: 'late-night', time: '03:00', sleepState: 'none', hasMeal: false },
            { id: 'wake', time: '07:00', sleepState: 'wake', hasMeal: false },
        ];

        const expanded = buildExpandedTimeline(timeSlots, 2);
        expect(expanded.dayBands).toHaveLength(1);
        expect(expanded.dayBands[0]?.afterDisplaySlotId).toBe('late-night__day0');
        expect(expanded.dayBands[0]?.dayNumber).toBe(2);
    });
});
