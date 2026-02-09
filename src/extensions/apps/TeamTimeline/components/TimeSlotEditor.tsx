import React from 'react';
import {
    Box,
    Typography,
    Button,
    IconButton,
    Select,
    MenuItem,
    Checkbox,
    FormControlLabel,
    Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import { useTranslation } from 'react-i18next';
import { styled } from '@mui/system';
import { TimeSlot, SleepStateLabel, getMealType, MealType } from '../types/TimeSlotTypes';
import { sortTimeSlots, generateTimeOptions } from '../utils/TimeSlotUtils';

interface TimeSlotEditorProps {
    timeSlots: TimeSlot[];
    onAdd: (slot: TimeSlot) => void;
    onUpdate: (index: number, slot: TimeSlot) => void;
    onRemove: (index: number) => void;
    onReset: () => void;
}

const timeOptions = generateTimeOptions();

// 一意なIDを生成（簡易版）
function generateSlotId(): string {
    return `slot-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export default function TimeSlotEditor({
    timeSlots,
    onAdd,
    onUpdate,
    onRemove,
    onReset,
}: TimeSlotEditorProps) {
    const { t } = useTranslation();

    // 時系列でソート
    const sortedSlots = React.useMemo(
        () => sortTimeSlots(timeSlots),
        [timeSlots]
    );

    // スロットのインデックスを取得
    const getSlotIndex = (slot: TimeSlot): number => {
        return timeSlots.findIndex((s) => s.id === slot.id);
    };

    // 時刻変更ハンドラー
    const handleTimeChange = (slot: TimeSlot, newTime: string) => {
        const index = getSlotIndex(slot);
        if (index !== -1) {
            onUpdate(index, { ...slot, time: newTime });
        }
    };

    // 睡眠状態変更ハンドラー
    const handleSleepStateChange = (slot: TimeSlot, newState: SleepStateLabel) => {
        const index = getSlotIndex(slot);
        if (index !== -1) {
            onUpdate(index, { ...slot, sleepState: newState });
        }
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

    // 削除ハンドラー
    const handleRemove = (slot: TimeSlot) => {
        const index = getSlotIndex(slot);
        if (index !== -1) {
            onRemove(index);
        }
    };

    // 追加ハンドラー
    const handleAdd = () => {
        const newSlot: TimeSlot = {
            id: generateSlotId(),
            time: '12:00',
            sleepState: 'none',
            hasMeal: false,
        };
        onAdd(newSlot);
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
                {sortedSlots.map((slot) => (
                    <SlotRow key={slot.id}>
                        {/* 時刻選択 */}
                        <Select
                            value={slot.time}
                            onChange={(e) => handleTimeChange(slot, e.target.value)}
                            size="small"
                            sx={{ width: 100 }}
                        >
                            {timeOptions.map((opt) => (
                                <MenuItem key={opt} value={opt}>
                                    {opt}
                                </MenuItem>
                            ))}
                        </Select>

                        {/* 睡眠状態選択 */}
                        <Select
                            value={slot.sleepState}
                            onChange={(e) =>
                                handleSleepStateChange(slot, e.target.value as SleepStateLabel)
                            }
                            size="small"
                            sx={{ width: 90 }}
                        >
                            <MenuItem value="none">-</MenuItem>
                            <MenuItem value="sleep">
                                {t('TeamTimeline.sleep state sleep', '就寝')}
                            </MenuItem>
                            <MenuItem value="wake">
                                {t('TeamTimeline.sleep state wake', '起床')}
                            </MenuItem>
                        </Select>

                        {/* 食事チェックボックス */}
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={slot.hasMeal}
                                    onChange={(e) => handleMealChange(slot, e.target.checked)}
                                    size="small"
                                />
                            }
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <span>{t('TeamTimeline.meal', '食事')}</span>
                                    {slot.hasMeal && (
                                        <Chip
                                            label={getMealLabel(getMealType(slot.time))}
                                            size="small"
                                            color="warning"
                                            sx={{ height: 20 }}
                                        />
                                    )}
                                </Box>
                            }
                            sx={{ ml: 1 }}
                        />

                        {/* 削除ボタン */}
                        <IconButton
                            size="small"
                            onClick={() => handleRemove(slot)}
                            sx={{ ml: 'auto' }}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </SlotRow>
                ))}
            </SlotList>

            {/* 追加ボタン */}
            <Button
                fullWidth
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAdd}
                sx={{ mt: 2 }}
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
