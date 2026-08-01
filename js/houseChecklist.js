/**
 * Keep this short. Long lists kill usage.
 * Supplies: true = stocked. Checks: true = done / OK before leaving.
 */

export const SUPPLY_ITEMS = [
    { key: 'toiletroll', label: 'Toilet Roll' },
    { key: 'binbags', label: 'Bin Bags' },
    { key: 'washingupliquid', label: 'Washing Up Liquid' },
    { key: 'dishwashertabs', label: 'Dishwasher Tabs' },
    { key: 'washingdetergent', label: 'Washing Detergent' },
    { key: 'logs', label: 'Logs' },
    { key: 'oliveoil', label: 'Olive Oil' },
    { key: 'milk', label: 'Milk' },
    { key: 'matches', label: 'Matches' },
    { key: 'shampoo', label: 'Shampoo' }
];

/** Only the leave-day things people will actually bother with */
export const HOUSE_CHECKS = [
    { key: 'fridgeok', label: 'Fridge not a science project' },
    { key: 'dishwasherempty', label: 'Dishwasher emptied' },
    { key: 'binsok', label: 'Bins emptied' }
];

export const SUPPLY_KEYS = SUPPLY_ITEMS.map(i => i.key);
export const CHECK_KEYS = HOUSE_CHECKS.map(i => i.key);

export function supplyLabel(key) {
    return SUPPLY_ITEMS.find(i => i.key === key)?.label || key;
}

export function checkLabel(key) {
    return HOUSE_CHECKS.find(i => i.key === key)?.label || key;
}

export function countMissingSupplies(supplies = {}) {
    return SUPPLY_KEYS.filter(k => supplies[k] !== true).length;
}

export function countFailedChecks(checks = {}) {
    return CHECK_KEYS.filter(k => checks[k] !== true).length;
}
