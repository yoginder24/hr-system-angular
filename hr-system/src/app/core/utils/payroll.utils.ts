// Net Salary = Basic Salary + Allowances - Deductions
// The result is rounded to 2 decimals to avoid computer rounding noise (0.1 + 0.2 problem).
export function calculateNetSalary(basic: number, allowances: number, deductions: number): number {
  const net = basic + allowances - deductions;
  return Math.round(net * 100) / 100;
}
