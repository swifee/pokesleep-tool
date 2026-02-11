import { describe, expect, it } from 'vitest';
import { TimeSlot } from '../types/TimeSlotTypes';
import { getTimeSlotValidationError } from './TimeSlotValidationUtils';

function createSlot(
    id: string,
    time: string,
    sleepState: TimeSlot['sleepState'] = 'none'
): TimeSlot {
    return {
        id,
        time,
        sleepState,
        hasMeal: false,
    };
}

describe('TimeSlotValidationUtils', () => {
    it('returns consecutiveWake when wake appears again without sleep in between', () => {
        const slots: TimeSlot[] = [
            createSlot('slot-1', '07:00', 'wake'),
            createSlot('slot-2', '12:00', 'none'),
            createSlot('slot-3', '18:00', 'wake'),
            createSlot('slot-4', '23:00', 'sleep'),
        ];

        expect(getTimeSlotValidationError(slots)).toBe('consecutiveWake');
    });

    it('accepts consecutive sleep as implied wake+sleep for count matching', () => {
        const slots: TimeSlot[] = [
            createSlot('slot-1', '07:00', 'wake'),
            createSlot('slot-2', '12:00', 'sleep'),
            createSlot('slot-3', '18:00', 'sleep'),
        ];

        expect(getTimeSlotValidationError(slots)).toBeNull();
    });

    it('returns wakeSleepCountMismatch when counts still do not match', () => {
        const slots: TimeSlot[] = [
            createSlot('slot-1', '07:00', 'wake'),
            createSlot('slot-2', '12:00', 'sleep'),
            createSlot('slot-3', '18:00', 'wake'),
        ];

        expect(getTimeSlotValidationError(slots)).toBe('wakeSleepCountMismatch');
    });

    it('returns tooManyWakeSleepPairs when three pairs are configured', () => {
        const slots: TimeSlot[] = [
            createSlot('slot-1', '14:00', 'wake'),
            createSlot('slot-2', '16:00', 'sleep'),
            createSlot('slot-3', '06:00', 'wake'),
            createSlot('slot-4', '08:00', 'sleep'),
            createSlot('slot-5', '10:00', 'wake'),
            createSlot('slot-6', '12:00', 'sleep'),
        ];

        expect(getTimeSlotValidationError(slots)).toBe('tooManyWakeSleepPairs');
    });

    it('returns null for valid up to two wake-sleep pairs', () => {
        const slots: TimeSlot[] = [
            createSlot('slot-1', '07:00', 'wake'),
            createSlot('slot-2', '12:00', 'sleep'),
            createSlot('slot-3', '18:00', 'wake'),
            createSlot('slot-4', '23:00', 'sleep'),
        ];

        expect(getTimeSlotValidationError(slots)).toBeNull();
    });
});
