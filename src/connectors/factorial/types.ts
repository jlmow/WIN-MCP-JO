/**
 * Tipos de domínio e contrato de acesso ao Factorial (plataforma de RH).
 *
 * Segue exatamente o mesmo padrão do `PhcConnector`: uma interface abstrata
 * + uma implementação mock, para que este segundo conector prove que o hub
 * não é específico do PHC — qualquer sistema (Sage, Primavera, SAP, Odoo,
 * Factorial, ...) se liga da mesma forma.
 */

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  jobTitle: string;
  active: boolean;
}

export interface ListEmployeesParams {
  search?: string;
  onlyActive?: boolean;
  limit?: number;
}

export interface FactorialConnector {
  listEmployees(params: ListEmployeesParams): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | null>;
}
