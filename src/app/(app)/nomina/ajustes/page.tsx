import { prisma } from "@/lib/prisma";
import { formatDateOnly } from "@/lib/date";
import { updateEmployeeProfile, updatePayrollSettings } from "@/lib/actions/payroll";

export default async function AjustesNominaPage() {
  const [settings, empleados] = await Promise.all([
    prisma.payrollSettings.findUnique({ where: { id: "singleton" } }),
    prisma.user.findMany({ where: { role: "EMPLEADA" }, include: { employeeProfile: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-verde-800">Ajustes de nómina</h1>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Valores legales vigentes</h2>
        <p className="mb-3 text-xs text-tierra-500">
          Actualiza estos valores cada vez que cambien por decreto (SMLMV, auxilio de transporte) o por ley
          (jornada semanal, porcentajes de salud/pensión).
        </p>
        <form action={updatePayrollSettings} className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">SMLMV (mensual, $)</label>
            <input type="number" step="1" name="smlmv" required className="input" defaultValue={settings?.smlmv ?? 0} />
          </div>
          <div>
            <label className="label">Auxilio de transporte (mensual, $)</label>
            <input type="number" step="1" name="auxilioTransporte" required className="input" defaultValue={settings?.auxilioTransporte ?? 0} />
          </div>
          <div>
            <label className="label">Jornada legal semanal (horas)</label>
            <input type="number" step="0.1" name="horasSemanaLegal" required className="input" defaultValue={settings?.horasSemanaLegal ?? 42} />
          </div>
          <div>
            <label className="label">Aporte salud empleado (%)</label>
            <input type="number" step="0.01" name="porcentajeSalud" required className="input" defaultValue={(settings?.porcentajeSalud ?? 0.04) * 100} />
          </div>
          <div>
            <label className="label">Aporte pensión empleado (%)</label>
            <input type="number" step="0.01" name="porcentajePension" required className="input" defaultValue={(settings?.porcentajePension ?? 0.04) * 100} />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">Guardar valores</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Perfil laboral por empleado(a)</h2>
        <div className="space-y-6">
          {empleados.map((u) => (
            <form key={u.id} action={updateEmployeeProfile} className="grid gap-3 border-b border-verde-50 pb-4 last:border-0 sm:grid-cols-4">
              <input type="hidden" name="userId" value={u.id} />
              <div className="sm:col-span-4 text-sm font-medium text-tierra-800">{u.name}</div>
              <div>
                <label className="label">Salario base mensual ($)</label>
                <input type="number" step="1" name="salarioBase" required className="input" defaultValue={u.employeeProfile?.salarioBase ?? 0} />
              </div>
              <div>
                <label className="label">Fecha de ingreso</label>
                <input type="date" name="fechaIngreso" required className="input" defaultValue={u.employeeProfile ? formatDateOnly(u.employeeProfile.fechaIngreso) : ""} />
              </div>
              <div className="flex items-end gap-2">
                <input type="checkbox" name="auxTransporte" id={`aux-${u.id}`} defaultChecked={u.employeeProfile?.auxTransporte ?? true} className="h-4 w-4" />
                <label htmlFor={`aux-${u.id}`} className="text-sm text-tierra-700">Recibe auxilio de transporte</label>
              </div>
              <div className="flex items-end">
                <button type="submit" className="btn-primary w-full">Guardar</button>
              </div>
            </form>
          ))}
          {empleados.length === 0 && (
            <p className="text-sm text-tierra-500">No hay empleadas registradas todavía.</p>
          )}
        </div>
      </div>
    </div>
  );
}
