export type PayrollStatus = 'Draft' | 'Processed' | 'Paid';

// Shape of one record in db.json -> "payroll"
export interface Payroll {
  id: number;
  employeeId: number; // links to employees.id
  salaryMonth: string; // "YYYY-MM", for example "2026-09"
  basicSalary: number; // a snapshot for that month
  allowances: number;
  deductions: number;
  netSalary: number; // basicSalary + allowances - deductions
  status: PayrollStatus;
}
