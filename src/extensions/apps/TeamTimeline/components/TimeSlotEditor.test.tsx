import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import TimeSlotEditor from './TimeSlotEditor';
import { TimeSlot } from '../types/TimeSlotTypes';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    }),
}));

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

function hasColorStyle(style: string | null, hexColor: string, rgbColor: string): boolean {
    if (!style) {
        return false;
    }
    return style.includes(hexColor) || style.includes(rgbColor);
}

function renderEditor(timeSlots: TimeSlot[]) {
    const onAdd = vi.fn();
    const onUpdate = vi.fn();
    const onRemove = vi.fn();
    const onReset = vi.fn();

    const view = render(
        <TimeSlotEditor
            timeSlots={timeSlots}
            onAdd={onAdd}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onReset={onReset}
        />
    );
    return {
        ...view,
        onAdd,
        onUpdate,
        onRemove,
        onReset,
    };
}

describe('TimeSlotEditor validation message', () => {
    it('shows consecutive wake message above add button', () => {
        renderEditor([
            createSlot('slot-1', '07:00', 'wake'),
            createSlot('slot-2', '12:00', 'none'),
            createSlot('slot-3', '18:00', 'wake'),
            createSlot('slot-4', '23:00', 'sleep'),
        ]);

        const message = screen.getByText('起床が連続しています');
        const addButton = screen.getByRole('button', { name: '時間帯を追加' });
        expect((message.compareDocumentPosition(addButton) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
    });

    it('shows wake-sleep count mismatch message', () => {
        renderEditor([
            createSlot('slot-1', '07:00', 'wake'),
            createSlot('slot-2', '12:00', 'sleep'),
            createSlot('slot-3', '18:00', 'wake'),
        ]);

        expect(screen.getByText('起床と就寝の回数が合っていません')).toBeDefined();
    });

    it('shows pair limit message when three or more pairs are configured', () => {
        renderEditor([
            createSlot('slot-1', '06:00', 'wake'),
            createSlot('slot-2', '08:00', 'sleep'),
            createSlot('slot-3', '10:00', 'wake'),
            createSlot('slot-4', '12:00', 'sleep'),
            createSlot('slot-5', '14:00', 'wake'),
            createSlot('slot-6', '16:00', 'sleep'),
        ]);

        expect(screen.getByText('起床、就寝は1日に2回までです。')).toBeDefined();
    });

    it('does not show validation message when up to two pairs are configured', () => {
        renderEditor([
            createSlot('slot-1', '07:00', 'wake'),
            createSlot('slot-2', '12:00', 'sleep'),
            createSlot('slot-3', '18:00', 'wake'),
            createSlot('slot-4', '23:00', 'sleep'),
        ]);

        expect(screen.queryByText('起床が連続しています')).toBeNull();
        expect(screen.queryByText('起床と就寝の回数が合っていません')).toBeNull();
        expect(screen.queryByText('起床、就寝は1日に2回までです。')).toBeNull();
    });
});

describe('TimeSlotEditor draft row', () => {
    it('adds unset draft row at bottom and registers only when time is selected', () => {
        const { onAdd } = renderEditor([]);

        fireEvent.click(screen.getByRole('button', { name: '時間帯を追加' }));

        expect(onAdd).not.toHaveBeenCalled();

        const draftRows = screen.getAllByTestId('time-slot-row-draft');
        expect(draftRows.length).toBe(1);
        expect(screen.getByText('未設定')).toBeDefined();
        expect(hasColorStyle(draftRows[0].getAttribute('style'), '#e7f0ff', '231, 240, 255')).toBe(true);

        const draftTimeSelect = within(draftRows[0]).getAllByRole('combobox')[0];
        fireEvent.mouseDown(draftTimeSelect);
        fireEvent.click(screen.getByRole('option', { name: '12:00' }));

        expect(onAdd).toHaveBeenCalledTimes(1);
        expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
            time: '12:00',
            sleepState: 'none',
            hasMeal: false,
        }));
        expect(screen.queryByText('未設定')).toBeNull();
    });

    it('drops draft row on unmount so it is not persisted', () => {
        const first = renderEditor([]);
        fireEvent.click(screen.getByRole('button', { name: '時間帯を追加' }));

        expect(screen.getByText('未設定')).toBeDefined();
        expect(first.onAdd).not.toHaveBeenCalled();
        first.unmount();

        render(
            <TimeSlotEditor
                timeSlots={[]}
                onAdd={vi.fn()}
                onUpdate={vi.fn()}
                onRemove={vi.fn()}
                onReset={vi.fn()}
            />
        );

        expect(screen.queryByText('未設定')).toBeNull();
    });
});

describe('TimeSlotEditor toggle buttons', () => {
    it('cycles sleep state button on each click', () => {
        function StatefulEditor() {
            const [slots, setSlots] = React.useState<TimeSlot[]>([
                createSlot('slot-1', '07:00', 'none'),
            ]);

            return (
                <TimeSlotEditor
                    timeSlots={slots}
                    onAdd={vi.fn()}
                    onUpdate={(index, slot) => {
                        setSlots((prev) => {
                            const next = [...prev];
                            next[index] = slot;
                            return next;
                        });
                    }}
                    onRemove={vi.fn()}
                    onReset={vi.fn()}
                />
            );
        }

        render(<StatefulEditor />);
        const row = screen.getAllByTestId('time-slot-row-saved')[0];

        fireEvent.click(within(row).getByRole('button', { name: '-' }));
        expect(within(row).getByRole('button', { name: '起床' })).toBeDefined();

        fireEvent.click(within(row).getByRole('button', { name: '起床' }));
        expect(within(row).getByRole('button', { name: '就寝' })).toBeDefined();

        fireEvent.click(within(row).getByRole('button', { name: '就寝' }));
        expect(within(row).getByRole('button', { name: '-' })).toBeDefined();
    });

    it('toggles meal button between meal and time-based meal label', () => {
        function StatefulEditor() {
            const [slots, setSlots] = React.useState<TimeSlot[]>([
                createSlot('slot-1', '07:00', 'none'),
            ]);

            return (
                <TimeSlotEditor
                    timeSlots={slots}
                    onAdd={vi.fn()}
                    onUpdate={(index, slot) => {
                        setSlots((prev) => {
                            const next = [...prev];
                            next[index] = slot;
                            return next;
                        });
                    }}
                    onRemove={vi.fn()}
                    onReset={vi.fn()}
                />
            );
        }

        render(<StatefulEditor />);
        const row = screen.getAllByTestId('time-slot-row-saved')[0];

        fireEvent.click(within(row).getByRole('button', { name: '食事' }));
        expect(within(row).getByRole('button', { name: '朝食' })).toBeDefined();

        fireEvent.click(within(row).getByRole('button', { name: '朝食' }));
        expect(within(row).getByRole('button', { name: '食事' })).toBeDefined();
    });
});

describe('TimeSlotEditor row move animation', () => {
    let originalGetBoundingClientRect: typeof HTMLElement.prototype.getBoundingClientRect;
    let viewportOffset = 0;

    beforeEach(() => {
        vi.useFakeTimers();
        viewportOffset = 0;
        originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function mockRect(this: HTMLElement) {
            if (this.dataset.rowKey) {
                const parent = this.parentElement;
                const rows = parent ? Array.from(parent.querySelectorAll('[data-row-key]')) : [];
                const index = rows.indexOf(this);
                const top = index >= 0 ? viewportOffset + (index * 40) : viewportOffset;
                return {
                    x: 0,
                    y: top,
                    width: 100,
                    height: 32,
                    top,
                    left: 0,
                    right: 100,
                    bottom: top + 32,
                    toJSON: () => ({}),
                } as DOMRect;
            }
            return originalGetBoundingClientRect.call(this);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('temporarily highlights moved rows after time edit', () => {
        function StatefulEditor() {
            const [slots, setSlots] = React.useState<TimeSlot[]>([
                createSlot('slot-1', '07:00', 'none'),
                createSlot('slot-2', '12:00', 'none'),
            ]);

            return (
                <TimeSlotEditor
                    timeSlots={slots}
                    onAdd={vi.fn()}
                    onUpdate={(index, slot) => {
                        setSlots((prev) => {
                            const next = [...prev];
                            next[index] = slot;
                            return next;
                        });
                    }}
                    onRemove={vi.fn()}
                    onReset={vi.fn()}
                />
            );
        }

        render(<StatefulEditor />);

        const savedRowsBefore = screen.getAllByTestId('time-slot-row-saved');
        const secondRowTimeSelect = within(savedRowsBefore[1]).getAllByRole('combobox')[0];
        fireEvent.mouseDown(secondRowTimeSelect);
        fireEvent.click(screen.getByRole('option', { name: '04:00' }));

        const movedRows = screen.getAllByTestId('time-slot-row-saved');
        const highlightedRows = movedRows.filter((row) => (
            hasColorStyle(row.getAttribute('style'), '#e7f0ff', '231, 240, 255')
        ));
        expect(highlightedRows.length).toBe(1);

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        const rowsAfterHighlight = screen.getAllByTestId('time-slot-row-saved');
        expect(
            rowsAfterHighlight.some((row) => hasColorStyle(row.getAttribute('style'), '#f5f5f5', '245, 245, 245'))
        ).toBe(true);
    });

    it('does not animate all rows on sleep-state change even when viewport position shifts', () => {
        function StatefulEditor() {
            const [slots, setSlots] = React.useState<TimeSlot[]>([
                createSlot('slot-1', '07:00', 'none'),
                createSlot('slot-2', '12:00', 'none'),
            ]);

            return (
                <TimeSlotEditor
                    timeSlots={slots}
                    onAdd={vi.fn()}
                    onUpdate={(index, slot) => {
                        setSlots((prev) => {
                            const next = [...prev];
                            next[index] = slot;
                            return next;
                        });
                    }}
                    onRemove={vi.fn()}
                    onReset={vi.fn()}
                />
            );
        }

        render(<StatefulEditor />);

        viewportOffset = 180;
        const firstRow = screen.getAllByTestId('time-slot-row-saved')[0];
        fireEvent.click(within(firstRow).getByRole('button', { name: '-' }));

        const rowsAfter = screen.getAllByTestId('time-slot-row-saved');
        rowsAfter.forEach((row) => {
            expect(row.style.transform).toBe('');
            expect(row.style.transition).toBe('');
        });
    });
});
