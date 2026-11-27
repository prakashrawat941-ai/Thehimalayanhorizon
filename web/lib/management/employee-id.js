export const EMPLOYEE_ID_PATTERN = '[A-Za-z0-9][A-Za-z0-9_\\-]{2,31}';
export const isEmployeeId = (value) => new RegExp(`^${EMPLOYEE_ID_PATTERN}$`).test(value);
