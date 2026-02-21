import React from 'react';
import {
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    FormControlLabel,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface SwapRemoveConfirmDialogProps {
    open: boolean;
    showRepeatOption: boolean;
    repeatChecked: boolean;
    onRepeatCheckedChange: (checked: boolean) => void;
    onCancel: () => void;
    onConfirm: () => void;
}

const SwapRemoveConfirmDialog = React.memo(({
    open,
    showRepeatOption,
    repeatChecked,
    onRepeatCheckedChange,
    onCancel,
    onConfirm,
}: SwapRemoveConfirmDialogProps) => {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
            <DialogContent>
                <Typography sx={{ fontSize: '14px' }}>
                    {t('TeamTimeline.swap remove confirm', '入れ替え設定を解除します。よろしいですか？')}
                </Typography>
                {showRepeatOption && (
                    <FormControlLabel
                        sx={{ mt: 1 }}
                        control={(
                            <Checkbox
                                checked={repeatChecked}
                                onChange={(_, checked) => onRepeatCheckedChange(checked)}
                            />
                        )}
                        label={t('TeamTimeline.swap remove future repeat', '以降の繰り返しも解除')}
                    />
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>
                    {t('cancel')}
                </Button>
                <Button onClick={onConfirm} variant="contained" color="primary">
                    {t('ok')}
                </Button>
            </DialogActions>
        </Dialog>
    );
});

SwapRemoveConfirmDialog.displayName = 'SwapRemoveConfirmDialog';

export default SwapRemoveConfirmDialog;
