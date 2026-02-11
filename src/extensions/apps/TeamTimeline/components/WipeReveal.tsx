import React from 'react';
import { Box, Collapse } from '@mui/material';

interface WipeRevealProps {
    show: boolean;
    children: React.ReactNode;
    durationMs?: number;
    delayMs?: number;
    appear?: boolean;
    enterEasing?: string;
    exitEasing?: string;
    testId?: string;
}

const WipeReveal = React.memo(({
    show,
    children,
    durationMs = 260,
    delayMs = 0,
    appear = true,
    enterEasing = 'cubic-bezier(0.2, 0, 0, 1)',
    exitEasing = 'cubic-bezier(0.4, 0, 1, 1)',
    testId,
}: WipeRevealProps) => {
    return (
        <Collapse
            in={show}
            timeout={durationMs}
            appear={appear}
            mountOnEnter
            unmountOnExit
            easing={{
                enter: enterEasing,
                exit: exitEasing,
            }}
            style={{ transitionDelay: `${delayMs}ms` }}
            sx={{
                overflow: 'hidden',
                transformOrigin: 'top',
                '& .MuiCollapse-wrapper': {
                    transformOrigin: 'top',
                },
            }}
        >
            <Box data-testid={testId}>
                {children}
            </Box>
        </Collapse>
    );
});

WipeReveal.displayName = 'WipeReveal';

export default WipeReveal;
