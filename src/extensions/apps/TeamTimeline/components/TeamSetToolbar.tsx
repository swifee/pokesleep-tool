import React, { useCallback, useMemo, useState } from 'react';
import {
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    MenuItem,
    Select,
    SelectChangeEvent,
    TextField,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { useTranslation } from 'react-i18next';
import type { TeamSetState } from '../types/TeamTimelineTypes';
import { SWAP_NONE_POKEMON_ID } from '../types/TimeSlotTypes';
import PokemonIcon from '../../../../ui/IvCalc/PokemonIcon';
import { formatSummaryEp } from '../utils/SummaryValueModeUtils';
import EpValue from './EpValue';

const CREATE_MENU_VALUE = -1;

interface TeamSetToolbarProps {
    teamSets: TeamSetState[];
    activeTeamSetIndex: number;
    currentSimulationContextHash: string;
    onSaveSettings: (name: string, saveCookingSettings: boolean, saveFieldSettings: boolean) => void;
    onCreate: () => void;
    onDuplicateAt: (index: number) => void;
    onDeleteAt: (index: number) => void;
    onSelect: (index: number) => void;
}

function countUniqueSwapPokemonIds(teamSet: TeamSetState): number {
    const uniquePokemonIds = new Set<number>();
    teamSet.swaps.forEach((swap) => {
        if (swap.newPokemonId !== SWAP_NONE_POKEMON_ID) {
            uniquePokemonIds.add(swap.newPokemonId);
        }
    });
    return uniquePokemonIds.size;
}

const EMPTY_SLOT_STYLE = {
    display: 'block',
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: '1px dashed #c7c7c7',
    backgroundColor: '#f5f5f5',
};

const FILLED_SLOT_STYLE = {
    display: 'block',
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    overflow: 'hidden',
    lineHeight: 0,
};

const TeamSetToolbar = React.memo(({
    teamSets,
    activeTeamSetIndex,
    currentSimulationContextHash,
    onSaveSettings,
    onCreate,
    onDuplicateAt,
    onDeleteAt,
    onSelect,
}: TeamSetToolbarProps) => {
    const { t } = useTranslation();
    const safeActiveIndex = Math.max(0, Math.min(activeTeamSetIndex, Math.max(teamSets.length - 1, 0)));
    const activeTeamSet = teamSets[safeActiveIndex];
    const [nameDialogOpen, setNameDialogOpen] = useState(false);
    const [nameDraft, setNameDraft] = useState('');
    const [saveCookingDraft, setSaveCookingDraft] = useState(false);
    const [saveFieldDraft, setSaveFieldDraft] = useState(false);

    const swapCountBySetId = useMemo(
        () => new Map(teamSets.map((teamSet) => [teamSet.id, countUniqueSwapPokemonIds(teamSet)])),
        [teamSets],
    );

    const handleOpenNameDialog = useCallback(() => {
        setNameDraft(activeTeamSet?.name ?? '');
        setSaveCookingDraft(activeTeamSet?.saveCookingSettings ?? false);
        setSaveFieldDraft(activeTeamSet?.saveFieldSettings ?? false);
        setNameDialogOpen(true);
    }, [activeTeamSet]);

    const handleCloseNameDialog = useCallback(() => {
        setNameDialogOpen(false);
    }, []);

    const handleSaveName = useCallback(() => {
        onSaveSettings(nameDraft, saveCookingDraft, saveFieldDraft);
        setNameDialogOpen(false);
    }, [nameDraft, onSaveSettings, saveCookingDraft, saveFieldDraft]);

    const handleSelectChange = (event: SelectChangeEvent<number>) => {
        const nextValue = Number(event.target.value);
        if (nextValue === CREATE_MENU_VALUE) {
            onCreate();
            return;
        }
        onSelect(nextValue);
    };

    return (
        <>
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '6px',
                    mb: '6px',
                }}
                data-testid="team-set-toolbar"
            >
                <Select<number>
                    size="small"
                    value={safeActiveIndex}
                    onChange={handleSelectChange}
                    displayEmpty
                    renderValue={(value) => teamSets[value]?.name ?? ''}
                    sx={{ minWidth: '220px', height: '32px' }}
                    inputProps={{ 'aria-label': t('TeamTimeline.team set select', 'チームセット選択') }}
                >
                    {teamSets.map((teamSet, index) => {
                        const swapCount = swapCountBySetId.get(teamSet.id) ?? 0;
                        const snapshot = teamSet.lastSimulationSnapshot;
                        const isStale = snapshot !== null && snapshot.settingsHash !== currentSimulationContextHash;
                        return (
                            <MenuItem key={teamSet.id} value={index} data-testid={`team-set-menu-item-${index}`}>
                                <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <Typography sx={{ fontSize: '12px', lineHeight: '15px' }}>
                                            {teamSet.name}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            {teamSet.team.map((member, memberIndex) => (
                                                member ? (
                                                    <Box
                                                        key={`${teamSet.id}-member-${memberIndex}`}
                                                        data-testid={`team-set-icon-${index}-${memberIndex}`}
                                                        style={FILLED_SLOT_STYLE}
                                                        sx={{ '& > div': { borderRadius: '4px', boxSizing: 'border-box' } }}
                                                    >
                                                        <PokemonIcon idForm={member.iv.idForm} size={18} />
                                                    </Box>
                                                ) : (
                                                    <Box key={`${teamSet.id}-member-${memberIndex}`} data-testid={`team-set-icon-${index}-${memberIndex}`}>
                                                        <span
                                                            style={EMPTY_SLOT_STYLE}
                                                            data-testid={`team-set-empty-slot-${index}-${memberIndex}`}
                                                        />
                                                    </Box>
                                                )
                                            ))}
                                            {swapCount > 0 ? (
                                                <Typography sx={{ fontSize: '11px', lineHeight: '14px', color: '#666' }}>
                                                    {t('TeamTimeline.team set swap count suffix', '+{{count}}', { count: swapCount })}
                                                </Typography>
                                            ) : null}
                                        </Box>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        <Box
                                            data-testid={`team-set-average-ep-${index}`}
                                            data-stale={isStale ? 'true' : 'false'}
                                            sx={{
                                                width: '118px',
                                                mr: '8px',
                                                textAlign: 'right',
                                                fontSize: '12px',
                                                lineHeight: '16px',
                                                color: isStale ? '#9e9e9e' : '#333',
                                                fontVariantNumeric: 'tabular-nums',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {snapshot ? <EpValue value={formatSummaryEp(snapshot.averageTotalEP)} /> : ''}
                                        </Box>
                                        <IconButton
                                            size="small"
                                            aria-label={t('TeamTimeline.team set duplicate', '複製')}
                                            data-testid={`team-set-duplicate-button-${index}`}
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                            }}
                                            onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                onDuplicateAt(index);
                                            }}
                                        >
                                            <ContentCopyIcon sx={{ fontSize: '18px' }} />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            aria-label={t('TeamTimeline.team set delete', '削除')}
                                            data-testid={`team-set-delete-button-${index}`}
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                            }}
                                            onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                onDeleteAt(index);
                                            }}
                                        >
                                            <DeleteIcon sx={{ fontSize: '18px' }} />
                                        </IconButton>
                                    </Box>
                                </Box>
                            </MenuItem>
                        );
                    })}
                    <MenuItem value={CREATE_MENU_VALUE} data-testid="team-set-create-menu-item">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AddIcon sx={{ fontSize: '18px' }} />
                            <Typography sx={{ fontSize: '13px', lineHeight: '16px' }}>
                                {t('TeamTimeline.team set create', '新規作成')}
                            </Typography>
                        </Box>
                    </MenuItem>
                </Select>

                <IconButton
                    size="small"
                    aria-label={t('TeamTimeline.team set edit name', 'チーム名を編集')}
                    data-testid="team-set-edit-name-button"
                    onClick={handleOpenNameDialog}
                >
                    <EditIcon />
                </IconButton>
            </Box>

            <Dialog
                open={nameDialogOpen}
                onClose={handleCloseNameDialog}
                maxWidth="xs"
                fullWidth
                data-testid="team-set-name-dialog"
            >
                <DialogTitle>{t('TeamTimeline.team set save settings', 'チーム保存設定')}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        value={nameDraft}
                        onChange={(event) => setNameDraft(event.target.value)}
                        label={t('TeamTimeline.team set name', 'チーム名')}
                        inputProps={{ 'aria-label': t('TeamTimeline.team set name', 'チーム名') }}
                        sx={{ mt: '4px' }}
                    />
                    <Box sx={{ mt: '8px', display: 'flex', flexDirection: 'column' }}>
                        <FormControlLabel
                            control={(
                                <Checkbox
                                    checked={saveCookingDraft}
                                    onChange={(event) => setSaveCookingDraft(event.target.checked)}
                                />
                            )}
                            label={t('TeamTimeline.team set save option cooking', '料理')}
                        />
                        <FormControlLabel
                            control={(
                                <Checkbox
                                    checked={saveFieldDraft}
                                    onChange={(event) => setSaveFieldDraft(event.target.checked)}
                                />
                            )}
                            label={t('TeamTimeline.team set save option field', 'フィールド')}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseNameDialog}>
                        {t('TeamTimeline.cancel', 'キャンセル')}
                    </Button>
                    <Button variant="contained" onClick={handleSaveName}>
                        {t('TeamTimeline.save', '保存')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
});

export default TeamSetToolbar;
