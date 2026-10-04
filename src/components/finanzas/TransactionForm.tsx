"use client";

import { useActionState, useMemo, useState } from "react";
import type { FinCategory, FinChannel, FinProduct, FinProductCategory, FinTransaction } from "@prisma/client";
import { createTransaction, updateTransaction } from "@/lib/actions/finanzas";
import { COMPANY_LABEL, type Company } from "@/lib/finanzas/queries";
import { formatDateOnly } from "@/lib/date";
import SubmitButton from "@/components/SubmitButton";
import ItemsPicker from "@/components/inventario/SaleItemsPicker";

export type TransactionKind = "venta" | "gasto" | "otro";

interface CompanyFormData {
  company: Company;
  categories: FinCategory[];
  channels: FinChannel[];
  products: (FinProduct & { categoria: FinProductCategory })[];
}

interface TransactionFormProps {
  companies: CompanyFormData[];
  kind: TransactionKind;
  transaction?: FinTransaction;
}

const KIND_LABELS: Record<TransactionKind, string> = {
  venta: "Nueva venta",
  gasto: "Nuevo gasto",
  otro: "Otro movimiento",
};

export default function TransactionForm({ companies, kind, transaction }: TransactionFormProps) {
  const isEdit = Boolean(transaction);
  const [company, setCompany] = useState<Company>(transaction?.company as Company ?? companies[0]?.company);
  const fixedType = kind === "venta" ? "income" : kind === "gasto" ? "expense" : null;
  const [tipo, setTipo] = useState<"income" | "expense">(fixedType ?? (transaction?.tipo as "income" | "expense") ?? "income");
  const channelRequired = kind === "venta";

  const activeCompany = companies.find((c) => c.company === company) ?? companies[0];

  const filteredCategories = useMemo(() => {
    if (!activeCompany) return [];
    if (kind === "venta") return activeCompany.categories.filter((c) => c.tipo === "ingreso_operacional");
    return activeCompany.categories.filter((c) =>
      tipo === "income"
        ? c.tipo === "ingreso_operacional" || c.tipo === "ingreso_no_operacional"
        : c.tipo !== "ingreso_operacional" && c.tipo !== "ingreso_no_operacional"
    );
  }, [activeCompany, kind, tipo]);

  const [resetKey, createAndReset] = useActionState(async (_prevKey: number, formData: FormData) => {
    await createTransaction(formData);
    return _prevKey + 1;
  }, 0);
  const action = isEdit ? updateTransaction.bind(null, transaction!.id) : createAndReset;

  if (companies.length === 0) return null;

  return (
    <form key={isEdit ? "edit" : resetKey} action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="tipo" value={tipo} />

      <div className="sm:col-span-2">
        <label className="label">Empresa</label>
        <select
          name="company"
          value={company}
          disabled={isEdit}
          onChange={(e) => setCompany(e.target.value as Company)}
          className="input"
        >
          {companies.map((c) => (
            <option key={c.company} value={c.company}>
              {COMPANY_LABEL[c.company]}
            </option>
          ))}
        </select>
      </div>

      {kind === "otro" && (
        <div className="sm:col-span-2">
          <label className="label">Tipo</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTipo("income")}
              className={tipo === "income" ? "btn-primary flex-1" : "btn-outline flex-1"}
            >
              Ingreso
            </button>
            <button
              type="button"
              onClick={() => setTipo("expense")}
              className={tipo === "expense" ? "btn-primary flex-1" : "btn-outline flex-1"}
            >
              Egreso
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="label">Fecha</label>
        <input
          type="date"
          name="fecha"
          required
          defaultValue={transaction ? formatDateOnly(transaction.fecha) : formatDateOnly(new Date())}
          className="input"
        />
      </div>
      <div>
        <label className="label">Monto (COP)</label>
        <input
          type="number"
          name="monto"
          min="0"
          step="1"
          required
          defaultValue={transaction?.monto}
          className="input"
        />
        {kind === "venta" && !isEdit && (
          <p className="mt-1 text-xs text-tierra-400">
            Se ignora si agregas productos abajo — en ese caso el monto se calcula solo.
          </p>
        )}
      </div>

      {kind === "venta" && !isEdit && (
        <>
          <div className="sm:col-span-2">
            <label className="label">¿Ya te pagaron?</label>
            <select name="estado" defaultValue="pagada" className="input">
              <option value="pagada">Sí, ya pagaron</option>
              <option value="pendiente">No, queda fiado</option>
            </select>
          </div>
          <ItemsPicker
            productos={(activeCompany?.products ?? []).map((p) => ({ id: p.id, nombre: p.nombre, precioDefault: p.precio, categoria: p.categoria.nombre }))}
            priceFieldName="precioUnitario"
          />
        </>
      )}

      <div className="sm:col-span-2">
        <label className="label">Categoría</label>
        <select name="categoriaId" required defaultValue={transaction?.categoriaId} className="input">
          <option value="" disabled>
            Selecciona una categoría
          </option>
          {filteredCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.codigo} · {cat.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2">
        <label className="label">{kind === "venta" ? "Canal de venta" : "Canal de venta (opcional)"}</label>
        <select
          name="canalId"
          required={channelRequired}
          defaultValue={transaction?.canalId ?? ""}
          className="input"
        >
          <option value="">{kind === "venta" ? "¿Dónde fue la venta?" : "Sin canal (gasto/ingreso compartido)"}</option>
          {activeCompany?.channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.nombre}
            </option>
          ))}
        </select>
        {kind !== "venta" && (
          <p className="mt-1 text-xs text-tierra-400">
            Déjalo vacío si es un gasto compartido (ej. nómina administrativa). Asígnalo si es
            directamente atribuible a un canal (ej. arriendo del local, domicilios).
          </p>
        )}
      </div>

      <div>
        <label className="label">Método de pago</label>
        <input name="metodoPago" placeholder="Efectivo, transferencia..." defaultValue={transaction?.metodoPago ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Cliente / Proveedor</label>
        <input name="contraparte" defaultValue={transaction?.contraparte ?? ""} className="input" />
      </div>

      <div className="sm:col-span-2">
        <label className="label">Descripción</label>
        <textarea name="descripcion" rows={2} defaultValue={transaction?.descripcion ?? ""} className="input" />
      </div>

      <div className="sm:col-span-2 flex items-center gap-2">
        <input
          type="checkbox"
          name="esIntercompania"
          id="esIntercompania"
          defaultChecked={transaction?.esIntercompania ?? false}
          className="h-4 w-4"
        />
        <label htmlFor="esIntercompania" className="text-sm text-tierra-700">
          Es una transacción entre Veragua y Melcoch (intercompañía)
        </label>
      </div>

      <div className="sm:col-span-2">
        <SubmitButton pendingText="Guardando...">
          {isEdit ? "Guardar cambios" : `Guardar ${KIND_LABELS[kind].toLowerCase()}`}
        </SubmitButton>
      </div>
    </form>
  );
}
