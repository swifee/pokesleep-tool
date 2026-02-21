import React from 'react';
import { styled } from '@mui/system';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    ButtonBase,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import PokemonBox, { PokemonBoxItem } from '../../../../util/PokemonBox';
import BoxFilterConfig from '../../../../util/PokemonBoxFilter';
import {
    BoxSortConfig,
    BoxSortType,
    sortPokemonItems,
    loadBoxSortConfig,
} from '../../../../util/PokemonBoxSort';
import { IngredientName, IngredientNames } from '../../../../data/pokemons';
import { MainSkillName, MainSkillNames } from '../../../../util/MainSkill';
import { createStrengthParameter, StrengthParameter } from '../../../../util/PokemonStrength';
import PokemonIcon from '../../../../ui/IvCalc/PokemonIcon';
import PokemonFilterFooter, { PokemonFilterFooterConfig } from '../../../../ui/IvCalc/PokemonFilterFooter';
import BoxFilterDialog from '../../../../ui/IvCalc/Box/BoxFilterDialog';
import BoxSortConfigFooter from '../../../../ui/IvCalc/Box/BoxSortConfigFooter';
import type { IvAction } from '../../../../ui/IvCalc/IvState';
import { DIALOG_PAPER_SX, DIALOG_SX } from './BoxSelectDialogStyles';

const LOCAL_STORAGE_KEY = 'PstTeamTimelineBoxSelectParam';
const SORT_TYPES: BoxSortType[] = [
    'level',
    'name',
    'pokedexno',
    'rp',
    'total strength',
    'berry',
    'ingredient',
    'skill',
];

interface StoredDialogConfig {
    sortConfig?: Partial<BoxSortConfig>;
    filterConfig?: Partial<BoxFilterConfig>;
    parameter?: Partial<StrengthParameter>;
}

interface DialogConfig {
    sortConfig: BoxSortConfig;
    filterConfig: BoxFilterConfig;
    parameter: StrengthParameter;
}

function isValidSortType(value: unknown): value is BoxSortType {
    return typeof value === 'string' && SORT_TYPES.includes(value as BoxSortType);
}

function isValidIngredientSortType(value: unknown): value is IngredientName | 'strength' | 'count' {
    return value === 'strength' ||
        value === 'count' ||
        (typeof value === 'string' && IngredientNames.includes(value as IngredientName));
}

function isValidMainSkillSortType(value: unknown): value is MainSkillName | 'strength' | 'count' {
    return value === 'strength' ||
        value === 'count' ||
        (typeof value === 'string' && MainSkillNames.includes(value as MainSkillName));
}

function normalizeSortConfig(value?: Partial<BoxSortConfig>): BoxSortConfig {
    const fallback = loadBoxSortConfig();
    return {
        sort: isValidSortType(value?.sort) ? value.sort : fallback.sort,
        ingredient: isValidIngredientSortType(value?.ingredient) ? value.ingredient : fallback.ingredient,
        mainSkill: isValidMainSkillSortType(value?.mainSkill) ? value.mainSkill : fallback.mainSkill,
        descending: typeof value?.descending === 'boolean' ? value.descending : fallback.descending,
        warnItems: typeof value?.warnItems === 'number' ? value.warnItems : fallback.warnItems,
        warnDate: typeof value?.warnDate === 'string' ? value.warnDate : fallback.warnDate,
    };
}

function loadDialogConfig(): DialogConfig {
    const fallback: DialogConfig = {
        sortConfig: normalizeSortConfig(),
        filterConfig: new BoxFilterConfig({}),
        parameter: createStrengthParameter({}),
    };
    const settings = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (settings === null) {
        return fallback;
    }

    try {
        const parsed = JSON.parse(settings) as StoredDialogConfig;
        return {
            sortConfig: normalizeSortConfig(parsed.sortConfig),
            filterConfig: new BoxFilterConfig(parsed.filterConfig ?? {}),
            parameter: createStrengthParameter(parsed.parameter ?? {}),
        };
    } catch {
        return fallback;
    }
}

function saveDialogConfig(config: DialogConfig): void {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
}

interface BoxSelectDialogProps {
    /** ダイアログの開閉状態 */
    open: boolean;
    /** ポケモンボックス */
    box: PokemonBox;
    /** ポケモン選択時のコールバック */
    onSelect: (item: PokemonBoxItem) => void;
    /** ダイアログを閉じる時のコールバック */
    onClose: () => void;
    /** 「なし」選択時のコールバック（入れ替え用ダイアログのみ） */
    onSelectNone?: () => void;
}

/**
 * ボックスからポケモンを選択するダイアログ
 */
const BoxSelectDialog = React.memo(({
    open,
    box,
    onSelect,
    onClose,
    onSelectNone,
}: BoxSelectDialogProps) => {
    const { t } = useTranslation();
    const items = box.items;
    const initialConfigRef = React.useRef<DialogConfig | null>(null);
    if (initialConfigRef.current === null) {
        initialConfigRef.current = loadDialogConfig();
    }

    const [sortConfig, setSortConfig] = React.useState<BoxSortConfig>(initialConfigRef.current.sortConfig);
    const [filterConfig, setFilterConfig] = React.useState<BoxFilterConfig>(initialConfigRef.current.filterConfig);
    const [parameter, setParameter] = React.useState<StrengthParameter>(initialConfigRef.current.parameter);
    const [filterOpen, setFilterOpen] = React.useState(false);

    React.useEffect(() => {
        saveDialogConfig({ sortConfig, filterConfig, parameter });
    }, [sortConfig, filterConfig, parameter]);

    const onFilterFooterChange = React.useCallback((value: PokemonFilterFooterConfig) => {
        setSortConfig((prev) => ({
            ...prev,
            sort: value.sort as BoxSortType,
            descending: value.descending,
        }));
    }, []);

    const onSortConfigChange = React.useCallback((value: BoxSortConfig) => {
        setSortConfig(value);
    }, []);

    const onFilterButtonClick = React.useCallback(() => {
        setFilterOpen(true);
    }, []);

    const onFilterDialogClose = React.useCallback(() => {
        setFilterOpen(false);
    }, []);

    const onFilterChange = React.useCallback((value: BoxFilterConfig) => {
        setFilterConfig(value);
    }, []);

    const onSortConfigDispatch = React.useCallback((action: IvAction) => {
        if (action.type === 'changeParameter') {
            setParameter(action.payload.parameter);
        }
    }, []);

    const filteredItems = React.useMemo(
        () => filterConfig.filter(items, parameter.evolved, t),
        [filterConfig, items, parameter.evolved, t]
    );
    const [sortedItems, errorMessage] = React.useMemo(
        () => sortPokemonItems(
            filteredItems,
            sortConfig.sort,
            sortConfig.descending,
            sortConfig.ingredient,
            sortConfig.mainSkill,
            parameter,
            t,
        ),
        [filteredItems, sortConfig, parameter, t]
    );
    const displayedItems = React.useMemo(
        () => (sortConfig.descending ? sortedItems : [...sortedItems].reverse()),
        [sortConfig.descending, sortedItems]
    );
    const footerConfig = React.useMemo<PokemonFilterFooterConfig>(() => ({
        isFiltered: !filterConfig.isEmpty,
        sort: sortConfig.sort,
        descending: sortConfig.descending,
    }), [filterConfig, sortConfig]);
    const emptyMessage = items.length === 0 ? t('box is empty') : errorMessage;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            sx={DIALOG_SX}
            maxWidth={false}
            fullWidth
            scroll="paper"
            PaperProps={{
                sx: DIALOG_PAPER_SX,
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {t('TeamTimeline.select pokemon')}
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers data-testid="team-timeline-box-select-content">
                {/* Special options for swap dialog */}
                {onSelectNone && (
                    <SpecialOptionsContainer>
                        <SpecialOptionButton onClick={onSelectNone}>
                            {t('TeamTimeline.swap none')}
                        </SpecialOptionButton>
                    </SpecialOptionsContainer>
                )}
                {displayedItems.length === 0 ? (
                    <EmptyMessage>{emptyMessage}</EmptyMessage>
                ) : (
                    <GridContainer>
                        {displayedItems.map((item) => (
                            <BoxItem
                                key={item.id}
                                item={item}
                                onClick={() => onSelect(item)}
                            />
                        ))}
                    </GridContainer>
                )}
            </DialogContent>
            <DialogActions disableSpacing sx={{ p: 0, m: 0 }}>
                <FooterArea data-testid="team-timeline-box-select-footer">
                    <BoxSortConfigFooter
                        sortConfig={sortConfig}
                        parameter={parameter}
                        dispatch={onSortConfigDispatch}
                        onChange={onSortConfigChange}
                    />
                    <PokemonFilterFooter
                        value={footerConfig}
                        sortTypes={SORT_TYPES}
                        onChange={onFilterFooterChange}
                        onFilterButtonClick={onFilterButtonClick}
                    />
                </FooterArea>
            </DialogActions>
            <BoxFilterDialog
                open={filterOpen}
                value={filterConfig}
                onChange={onFilterChange}
                onClose={onFilterDialogClose}
            />
        </Dialog>
    );
});

interface BoxItemProps {
    item: PokemonBoxItem;
    onClick: () => void;
}

/**
 * ボックス内のポケモンアイテム（グリッド表示用）
 */
const BoxItem = React.memo(({ item, onClick }: BoxItemProps) => {
    const { t } = useTranslation();

    return (
        <StyledBoxItem>
            <ButtonBase onClick={onClick} className="item-button">
                <header>
                    <span className="lv">Lv.</span>
                    {item.iv.level}
                </header>
                <PokemonIcon idForm={item.iv.idForm} size={32} />
                <footer data-testid="team-timeline-box-item-name">{item.filledNickname(t)}</footer>
            </ButtonBase>
        </StyledBoxItem>
    );
});

const GridContainer = styled('div')({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    justifyContent: 'flex-start',
    marginBottom: '8px',
});

const EmptyMessage = styled('div')({
    textAlign: 'center',
    color: '#888',
    padding: '2rem',
    fontSize: '0.9rem',
});

const SpecialOptionsContainer = styled('div')({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '12px',
});

const SpecialOptionButton = styled(ButtonBase)({
    fontFamily: '"M PLUS 1p"',
    padding: '8px 16px',
    border: '1px solid #ccc',
    borderRadius: '0.5rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#555',
    backgroundColor: '#fafafa',
    '&:hover': {
        backgroundColor: '#e8e8e8',
        borderColor: '#999',
    },
});

const StyledBoxItem = styled('div')({
    '& .item-button': {
        fontFamily: '"M PLUS 1p"',
        display: 'block',
        textAlign: 'center',
        width: '80px',
        padding: '0.2rem 0',
        border: '1px solid transparent',
        borderRadius: '0.5rem',
        '&:hover': {
            backgroundColor: '#f0f0f0',
            border: '1px solid #ccc',
        },
        '& > header': {
            fontSize: '0.7rem',
            fontWeight: 'bold',
            '& > span.lv': {
                color: '#62d540',
                fontSize: '0.6rem',
                paddingRight: '0.2rem',
            },
        },
        '& > div': {
            margin: '0.1rem auto 0.1rem',
        },
        '& > footer': {
            fontSize: '0.8rem',
            color: '#666666',
            overflowWrap: 'anywhere',
            maxWidth: '76px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        },
    },
});

const FooterArea = styled('div')({
    width: '100%',
    padding: 0,
    boxSizing: 'border-box',
});

export default BoxSelectDialog;
