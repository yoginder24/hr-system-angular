export interface Department {
  id: number;
  name: string;
  description: string;
  managerId: number | null; // an employee id, or null if there is no manager
}
