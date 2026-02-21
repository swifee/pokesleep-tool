import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TeamTimelineIcon, { TeamTimelineIconName } from './TimelineIcons';

const ICON_NAMES: readonly TeamTimelineIconName[] = [
    'bag',
    'berry',
    'cooking',
    'dream',
    'heal',
    'skill',
    'skill_none',
    'sleep',
    'wakeup',
    'work',
];

describe('TeamTimelineIcon', () => {
    ICON_NAMES.forEach((name) => {
        it(`renders ${name} icon`, () => {
            render(<TeamTimelineIcon name={name} data-testid={`timeline-icon-${name}`} />);
            const icon = screen.getByTestId(`timeline-icon-${name}`);
            expect(icon.tagName.toLowerCase()).toBe('svg');
            expect(icon.querySelector('path, circle, rect')).not.toBeNull();
        });
    });
});
