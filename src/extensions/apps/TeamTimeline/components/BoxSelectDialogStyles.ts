export const DIALOG_SX = {
    '& .MuiDialog-container': {
        alignItems: 'center',
    },
} as const;

export const DIALOG_PAPER_SX = {
    width: 'min(720px, calc(100% - 24px))',
    margin: '12px',
    maxHeight: 'calc(100% - 24px)',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
} as const;
