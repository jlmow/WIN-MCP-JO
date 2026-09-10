import type { Employee, FactorialConnector, ListEmployeesParams } from "./types.js";

/** Implementação de referência com dados em memória — ver `MockPhcConnector` para a mesma ideia aplicada ao PHC. */
export class MockFactorialConnector implements FactorialConnector {
  private employees: Employee[] = [
    { id: "E001", name: "Ana Ferreira", email: "ana.ferreira@winsig.pt", department: "Engenharia", jobTitle: "Engenheira de Software", active: true },
    { id: "E002", name: "Bruno Costa", email: "bruno.costa@winsig.pt", department: "Vendas", jobTitle: "Gestor de Contas", active: true },
    { id: "E003", name: "Carla Nunes", email: "carla.nunes@winsig.pt", department: "Recursos Humanos", jobTitle: "Diretora de RH", active: true },
    { id: "E004", name: "Diogo Silva", email: "diogo.silva@winsig.pt", department: "Engenharia", jobTitle: "Engenheiro de Software", active: false },
  ];

  async listEmployees(params: ListEmployeesParams): Promise<Employee[]> {
    const search = params.search?.toLowerCase();
    let filtered = this.employees;
    if (search) {
      filtered = filtered.filter(
        (e) => e.name.toLowerCase().includes(search) || e.department.toLowerCase().includes(search) || e.email.toLowerCase().includes(search),
      );
    }
    if (params.onlyActive) {
      filtered = filtered.filter((e) => e.active);
    }
    return filtered.slice(0, params.limit ?? 50);
  }

  async getEmployee(id: string): Promise<Employee | null> {
    return this.employees.find((e) => e.id === id) ?? null;
  }
}
