import React from 'react';
import {
    Box,
    Typography,
    Button,
    IconButton,
    Select,
    MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import { useTranslation } from 'react-i18next';
import { styled } from '@mui/system';
import { TimeSlot, SleepStateLabel, getMealType, MealType } from '../types/TimeSlotTypes';
import { sortTimeSlots, generateTimeOptions } from '../utils/TimeSlotUtils';
import { getTimeSlotValidationError } from '../utils/TimeSlotValidationUtils';

interface TimeSlotEditorProps {
    timeSlots: TimeSlot[];
    onAdd: (slot: TimeSlot) => void;
    onUpdate: (index: number, slot: TimeSlot) => void;
    onRemove: (index: number) => void;
    onReset: () => void;
}

const timeOptions = generateTimeOptions();
const UNSET_TIME_VALUE = '__unset__';
const ROW_MOVE_ANIMATION_MS = 1000;
const DEFAULT_ROW_BACKGROUND = '#f5f5f5';
const DRAFT_ROW_BACKGROUND = '#e7f0ff';
const INACTIVE_BUTTON_BACKGROUND = '#eceff1';
const INACTIVE_BUTTON_TEXT = '#6f7782';
const WAKE_BUTTON_BACKGROUND = '#f1c525';
const SLEEP_BUTTON_BACKGROUND = '#579bf3';
const ACTIVE_BUTTON_TEXT = '#ffffff';
const MEAL_ACTIVE_BUTTON_BACKGROUND = '#e8a33b';
const MEAL_INACTIVE_BUTTON_TEXT = '#b7c0c9';

type RowKind = 'saved' | 'draft';
type ToggleButtonStyle = {
    backgroundColor: string;
    color: string;
};

interface DisplayRow {
    rowKey: string;
    kind: RowKind;
    slot: TimeSlot;
}

const SLEEP_STATE_CYCLE: readonly SleepStateLabel[] = ['none', 'wake', 'sleep'];

const SLEEP_STATE_STYLE_MAP: Record<SleepStateLabel, ToggleButtonStyle> = {
    none: {
        backgroundColor: INACTIVE_BUTTON_BACKGROUND,
        color: INACTIVE_BUTTON_TEXT,
    },
    wake: {
        backgroundColor: WAKE_BUTTON_BACKGROUND,
        color: ACTIVE_BUTTON_TEXT,
    },
    sleep: {
        backgroundColor: SLEEP_BUTTON_BACKGROUND,
        color: ACTIVE_BUTTON_TEXT,
    },
};

// 一意なIDを生成（簡易版）
function generateSlotId(): string {
    return `slot-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getNextSleepState(current: SleepStateLabel): SleepStateLabel {
    const currentIndex = SLEEP_STATE_CYCLE.indexOf(current);
    const nextIndex = (currentIndex + 1) % SLEEP_STATE_CYCLE.length;
    return SLEEP_STATE_CYCLE[nextIndex];
}

function createTypeLikeButtonSx(style: ToggleButtonStyle) {
    return {
        minWidth: '4.6rem',
        width: '4.6rem',
        height: '1.8rem',
        fontSize: '0.8rem',
        lineHeight: '1rem',
        borderRadius: '0.5rem',
        px: 0,
        py: 0,
        textTransform: 'none',
        border: 0,
        backgroundColor: style.backgroundColor,
        color: style.color,
        boxShadow: 'none',
        '&:hover': {
            border: 0,
            backgroundColor: style.backgroundColor,
            boxShadow: 'none',
        },
        '&.Mui-disabled': {
            border: 0,
            backgroundColor: style.backgroundColor,
            color: style.color,
            opacity: 0.65,
        },
    };
}

export default function TimeSlotEditor({
    timeSlots,
    onAdd,
    onUpdate,
    onRemove,
    onReset,
}: TimeSlotEditorProps) {
    const { t } = useTranslation();
    const [draftSlots, setDraftSlots] = React.useState<TimeSlot[]>([]);
    const [highlightedRowKey, setHighlightedRowKey] = React.useState<string | null>(null);
    const rowElementsRef = React.useRef<Map<string, HTMLDivElement>>(new Map());
    const previousTopByRowKeyRef = React.useRef<Map<string, number>>(new Map());
    const moveHighlightTimeoutRef = React.useRef<number | null>(null);
    const pendingHighlightRowKeyRef = React.useRef<string | null>(null);

    // 時系列でソート
    const sortedSlots = React.useMemo(
        () => sortTimeSlots(timeSlots),
        [timeSlots]
    );
    const displayRows = React.useMemo<DisplayRow[]>(
        () => ([
            ...sortedSlots.map((slot) => ({
                rowKey: slot.id,
                kind: 'saved' as const,
                slot,
            })),
            ...draftSlots.map((slot) => ({
                rowKey: slot.id,
                kind: 'draft' as const,
                slot,
            })),
        ]),
        [sortedSlots, draftSlots]
    );

    React.useLayoutEffect(() => {
        const currentTopByRowKey = new Map<string, number>();
        const movedKeys: string[] = [];
        const pendingHighlightRowKey = pendingHighlightRowKeyRef.current;
        pendingHighlightRowKeyRef.current = null;
        const shouldAnimateRowMove = pendingHighlightRowKey !== null;

        displayRows.forEach(({ rowKey }) => {
            const element = rowElementsRef.current.get(rowKey);
            if (!element) {
                return;
            }
            const currentTop = element.getBoundingClientRect().top;
            currentTopByRowKey.set(rowKey, currentTop);
            if (!shouldAnimateRowMove) {
                return;
            }

            const previousTop = previousTopByRowKeyRef.current.get(rowKey);
            if (previousTop === undefined) {
                return;
            }

            const deltaY = previousTop - currentTop;
            if (Math.abs(deltaY) < 1) {
                return;
            }

            movedKeys.push(rowKey);
            element.style.transition = 'none';
            element.style.transform = `translateY(${deltaY}px)`;
            void element.getBoundingClientRect();
            element.style.transition = `transform ${ROW_MOVE_ANIMATION_MS}ms ease`;
            element.style.transform = 'translateY(0)';
        });

        previousTopByRowKeyRef.current = currentTopByRowKey;
        if (!shouldAnimateRowMove || movedKeys.length === 0) {
            return;
        }

        const targetHighlightRowKey = movedKeys.includes(pendingHighlightRowKey)
            ? pendingHighlightRowKey
            : null;
        if (targetHighlightRowKey === null) {
            return;
        }

        setHighlightedRowKey(targetHighlightRowKey);
        if (moveHighlightTimeoutRef.current !== null) {
            window.clearTimeout(moveHighlightTimeoutRef.current);
        }
        moveHighlightTimeoutRef.current = window.setTimeout(() => {
            setHighlightedRowKey(null);
            moveHighlightTimeoutRef.current = null;
        }, ROW_MOVE_ANIMATION_MS);
    }, [displayRows]);

    React.useEffect(() => () => {
        if (moveHighlightTimeoutRef.current !== null) {
            window.clearTimeout(moveHighlightTimeoutRef.current);
        }
    }, []);

    const validationError = React.useMemo(
        () => getTimeSlotValidationError(timeSlots),
        [timeSlots]
    );
    const validationMessage = React.useMemo(() => {
        switch (validationError) {
            case 'consecutiveWake':
                return t('TeamTimeline.time slot validation consecutive wake', '起床が連続しています');
            case 'wakeSleepCountMismatch':
                return t(
                    'TeamTimeline.time slot validation wake sleep mismatch',
                    '起床と就寝の回数が合っていません'
                );
            case 'tooManyWakeSleepPairs':
                return t('TeamTimeline.time slot validation too many pairs', '起床、就寝は1日に2回までです。');
            default:
                return null;
        }
    }, [validationError, t]);

    // スロットのインデックスを取得
    const getSlotIndex = (slot: TimeSlot): number => {
        return timeSlots.findIndex((s) => s.id === slot.id);
    };
    const getDraftSlot = (slotId: string): TimeSlot | undefined => draftSlots.find((slot) => slot.id === slotId);
    const isUnsetDraftSlot = (slot: TimeSlot, kind: RowKind): boolean => (
        kind === 'draft' && slot.time === UNSET_TIME_VALUE
    );
    const resolveRowBackgroundColor = (rowKey: string, isUnsetDraft: boolean): string => {
        if (highlightedRowKey === rowKey) {
            return DRAFT_ROW_BACKGROUND;
        }
        if (isUnsetDraft) {
            return DRAFT_ROW_BACKGROUND;
        }
        return DEFAULT_ROW_BACKGROUND;
    };
    const registerRowElement = (rowKey: string, element: HTMLDivElement | null) => {
        if (element) {
            rowElementsRef.current.set(rowKey, element);
            return;
        }
        rowElementsRef.current.delete(rowKey);
    };

    // 時刻変更ハンドラー
    const handleTimeChange = (slot: TimeSlot, newTime: string) => {
        const index = getSlotIndex(slot);
        if (index !== -1) {
            if (slot.time !== newTime) {
                pendingHighlightRowKeyRef.current = slot.id;
            }
            onUpdate(index, { ...slot, time: newTime });
        }
    };
    const handleDraftTimeChange = (slotId: string, newTime: string) => {
        if (newTime === UNSET_TIME_VALUE) {
            return;
        }
        const draft = getDraftSlot(slotId);
        if (!draft) {
            return;
        }
        pendingHighlightRowKeyRef.current = slotId;
        onAdd({
            ...draft,
            time: newTime,
            hasMeal: false,
        });
        setDraftSlots(current => current.filter((slot) => slot.id !== slotId));
    };

    // 睡眠状態変更ハンドラー
    const handleSleepStateChange = (slot: TimeSlot, newState: SleepStateLabel) => {
        const index = getSlotIndex(slot);
        if (index !== -1) {
            onUpdate(index, { ...slot, sleepState: newState });
        }
    };
    const handleDraftSleepStateChange = (slotId: string, newState: SleepStateLabel) => {
        setDraftSlots((current) => current.map((slot) => (
            slot.id === slotId
                ? { ...slot, sleepState: newState }
                : slot
        )));
    };

    // 食事チェック変更ハンドラー（排他制御付き）
    const handleMealChange = (slot: TimeSlot, checked: boolean) => {
        const index = getSlotIndex(slot);
        if (index === -1) return;

        if (checked) {
            // 同じ食事タイプの既存チェックを外す
            const mealType = getMealType(slot.time);
            timeSlots.forEach((s, i) => {
                if (s.id !== slot.id && s.hasMeal && getMealType(s.time) === mealType) {
                    onUpdate(i, { ...s, hasMeal: false });
                }
            });
        }
        onUpdate(index, { ...slot, hasMeal: checked });
    };
    const handleMealToggle = (slot: TimeSlot) => {
        handleMealChange(slot, !slot.hasMeal);
    };

    // 削除ハンドラー
    const handleRemove = (slot: TimeSlot) => {
        const index = getSlotIndex(slot);
        if (index !== -1) {
            onRemove(index);
        }
    };
    const handleDraftRemove = (slotId: string) => {
        setDraftSlots((current) => current.filter((slot) => slot.id !== slotId));
    };

    // 追加ハンドラー
    const handleAdd = () => {
        const newSlot: TimeSlot = {
            id: generateSlotId(),
            time: UNSET_TIME_VALUE,
            sleepState: 'none',
            hasMeal: false,
        };
        setDraftSlots((current) => [...current, newSlot]);
    };

    // 食事タイプの表示名を取得
    const getMealLabel = (mealType: MealType): string => {
        switch (mealType) {
            case 'breakfast':
                return t('TeamTimeline.meal breakfast', '朝食');
            case 'lunch':
                return t('TeamTimeline.meal lunch', '昼食');
            case 'dinner':
                return t('TeamTimeline.meal dinner', '夕食');
        }
    };
    const getSleepStateButtonLabel = (sleepState: SleepStateLabel): string => {
        switch (sleepState) {
            case 'wake':
                return t('TeamTimeline.sleep state wake', '起床');
            case 'sleep':
                return t('TeamTimeline.sleep state sleep', '就寝');
            default:
                return '-';
        }
    };
    const getSleepStateButtonSx = (sleepState: SleepStateLabel) => {
        const style = SLEEP_STATE_STYLE_MAP[sleepState];
        return createTypeLikeButtonSx(style);
    };
    const getMealButtonLabel = (slot: TimeSlot): string => (
        slot.hasMeal
            ? getMealLabel(getMealType(slot.time))
            : t('TeamTimeline.meal', '食事')
    );
    const getMealButtonSx = (hasMeal: boolean) => ({
        ...createTypeLikeButtonSx({
            backgroundColor: hasMeal ? MEAL_ACTIVE_BUTTON_BACKGROUND : INACTIVE_BUTTON_BACKGROUND,
            color: hasMeal ? ACTIVE_BUTTON_TEXT : MEAL_INACTIVE_BUTTON_TEXT,
        }),
    });

    return (
        <Box>
            {/* ヘッダー */}
            <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={2}
            >
                <Typography variant="h6">
                    {t('TeamTimeline.time slots', '時間帯設定')}
                </Typography>
                <Button
                    size="small"
                    startIcon={<RestoreIcon />}
                    onClick={onReset}
                >
                    {t('TeamTimeline.reset to default', 'デフォルトにリセット')}
                </Button>
            </Box>

            {/* 時間帯リスト（インライン編集） */}
            <SlotList>
                {displayRows.map(({ rowKey, kind, slot }) => {
                    const unsetDraft = isUnsetDraftSlot(slot, kind);
                    const rowBackgroundColor = resolveRowBackgroundColor(rowKey, unsetDraft);
                    return (
                    <SlotRow
                        key={rowKey}
                        ref={(element) => registerRowElement(rowKey, element)}
                        style={{ backgroundColor: rowBackgroundColor }}
                        data-testid={`time-slot-row-${kind}`}
                        data-row-key={rowKey}
                    >
                        {/* 時刻選択 */}
                        <Select
                            value={slot.time}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (kind === 'draft') {
                                    handleDraftTimeChange(slot.id, value);
                                    return;
                                }
                                handleTimeChange(slot, value);
                            }}
                            size="small"
                            sx={{ width: 100 }}
                        >
                            {kind === 'draft' && (
                                <MenuItem value={UNSET_TIME_VALUE}>
                                    {t('TeamTimeline.time slot unset', '未設定')}
                                </MenuItem>
                            )}
                            {timeOptions.map((opt) => (
                                <MenuItem key={opt} value={opt}>
                                    {opt}
                                </MenuItem>
                            ))}
                        </Select>

                        {/* 睡眠状態トグル */}
                        <Button
                            variant="contained"
                            disableElevation
                            onClick={() => {
                                const nextState = getNextSleepState(slot.sleepState);
                                if (kind === 'draft') {
                                    handleDraftSleepStateChange(slot.id, nextState);
                                    return;
                                }
                                handleSleepStateChange(slot, nextState);
                            }}
                            size="small"
                            sx={getSleepStateButtonSx(slot.sleepState)}
                        >
                            {getSleepStateButtonLabel(slot.sleepState)}
                        </Button>

                        {/* 食事トグル */}
                        <Button
                            variant="contained"
                            disableElevation
                            onClick={() => handleMealToggle(slot)}
                            disabled={kind === 'draft' || unsetDraft}
                            size="small"
                            sx={getMealButtonSx(slot.hasMeal)}
                        >
                            {getMealButtonLabel(slot)}
                        </Button>

                        {/* 削除ボタン */}
                        <IconButton
                            size="small"
                            onClick={() => (kind === 'draft' ? handleDraftRemove(slot.id) : handleRemove(slot))}
                            sx={{ ml: 'auto' }}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </SlotRow>
                    );
                })}
            </SlotList>

            {validationMessage && (
                <Typography
                    role="alert"
                    sx={{ mt: 2, mb: 1, color: 'error.main', fontSize: '12px', fontWeight: 700 }}
                >
                    {validationMessage}
                </Typography>
            )}

            {/* 追加ボタン */}
            <Button
                fullWidth
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAdd}
                sx={{ mt: validationMessage ? 0 : 2 }}
            >
                {t('TeamTimeline.add time slot', '時間帯を追加')}
            </Button>
        </Box>
    );
}

const SlotList = styled('div')({
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
});

const SlotRow = styled('div')({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
});
