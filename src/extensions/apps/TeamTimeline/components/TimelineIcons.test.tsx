import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TeamTimelineIcon, { TeamTimelineIconName } from './TimelineIcons';

const ICON_NAMES: readonly TeamTimelineIconName[] = [
    'bag',
    'berry',
    'change',
    'cooking',
    'dream',
    'heal',
    'pickup',
    'pickup_none',
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

    it('renders skill_none with transparent interior', () => {
        render(<TeamTimelineIcon name="skill_none" data-testid="timeline-icon-skill-none-transparent" />);
        const icon = screen.getByTestId('timeline-icon-skill-none-transparent');
        expect(icon.querySelector('path')?.getAttribute('fill')).toBe('none');
        expect(icon.querySelector('circle')?.getAttribute('fill')).toBe('none');
    });
});
