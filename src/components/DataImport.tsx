'use client';
import { useState } from 'react';
import {
  UserPlus, Upload, AlertCircle, CheckCircle2,
  Loader2, ChevronDown, User, Phone, Users,
  Baby, VenetianMask, ShieldAlert, X
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { IS_MOCK_MODE } from '@/lib/mockData';

// ─── Tipos locales ────────────────────────────────────────────────────────────
interface FormState {
  nombre: string;
  apellido: string;
  grupo: string;
  edad: string;
  sexo: string;
  observaciones: string;
  acudiente_nombre: string;
  acudiente_telefono: string;
}

const BLANK_FORM: FormState = {
  nombre: '',
  apellido: '',
  grupo: '',
  edad: '',
  sexo: '',
  observaciones: '',
  acudiente_nombre: '',
  acudiente_telefono: '',
};

const GRUPOS = ['STEPHANY', 'ANDREA', 'JULIANA', 'SAIN', 'GORKA'];

// ─── Helper: campo de formulario ─────────────────────────────────────────────
function Field({
  label, icon, children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all ' +
  'placeholder:text-slate-300 bg-slate-50 focus:bg-white';

// ─── Sección 1: Registro rápido individual ────────────────────────────────────
function QuickAddForm() {
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [isCuidador, setIsCuidador] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.apellido.trim() || (!isCuidador && !form.grupo)) {
      setResult({ type: 'error', text: `Nombre y Apellido son obligatorios${!isCuidador ? ' junto con el Grupo.' : '.'}` });
      return;
    }

    setSaving(true);
    setResult(null);

    try {
      if (IS_MOCK_MODE) {
        // Simulación en modo mock
        await new Promise(r => setTimeout(r, 600));
      } else {
        if (isCuidador) {
          const cuidadorPayload = {
            nombre: form.nombre.trim(),
            apellido: form.apellido.trim(),
            telefono: form.acudiente_telefono.trim() || null,
            grupo: form.grupo || null,
            rol: form.observaciones.trim() || null,
          };
          const { error } = await supabase.from('cuidadores').insert([cuidadorPayload]);
          if (error) throw error;
        } else {
          const payload = {
            nombre:            form.nombre.trim(),
            apellido:          form.apellido.trim(),
            grupo:             form.grupo,
            edad:              form.edad ? parseInt(form.edad) : null,
            sexo:              form.sexo || null,
            observaciones:     form.observaciones.trim() || null,
            acudiente_nombre:  form.acudiente_nombre.trim() || null,
            acudiente_telefono: form.acudiente_telefono.trim() || null,
          };
          const { error } = await supabase.from('ninos').insert([payload]);
          if (error) throw error;
        }
      }

      setResult({
        type: 'success',
        text: `✅ ${form.nombre} ${form.apellido} registrado como ${isCuidador ? 'cuidador' : `niño en ${form.grupo}`}.`,
      });
      setForm(BLANK_FORM);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[QuickAdd] error:', msg);
      setResult({ type: 'error', text: `No se pudo guardar: ${msg}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
        <h2 className="text-white font-black text-xl flex items-center gap-2">
          <UserPlus size={22} />
          Agregar Registro de Último Momento
        </h2>
        <p className="text-indigo-200 text-sm mt-1 font-medium">
          Completa los campos y presiona Guardar — se añade directo a Supabase.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">

        {/* Toggle Cuidador */}
        <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
          <input
            type="checkbox"
            className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            checked={isCuidador}
            onChange={(e) => setIsCuidador(e.target.checked)}
          />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-800">Registrar como Cuidador</span>
            <span className="text-xs text-slate-500">Activa esto si la persona es parte del equipo de logística/liderazgo.</span>
          </div>
        </label>

        {/* Nombre + Apellido */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre *" icon={<User size={12} />}>
            <input
              className={inputCls}
              placeholder="Ej: María"
              value={form.nombre}
              onChange={set('nombre')}
              required
            />
          </Field>
          <Field label="Apellido *" icon={<User size={12} />}>
            <input
              className={inputCls}
              placeholder="Ej: García"
              value={form.apellido}
              onChange={set('apellido')}
              required
            />
          </Field>
        </div>

        {/* Grupo */}
        <Field label={isCuidador ? "Grupo / Área (Opcional)" : "Grupo / Responsable *"} icon={<Users size={12} />}>
          <div className="relative">
            {isCuidador ? (
              <input
                className={inputCls}
                placeholder="Ej: Logística, Cocina, etc."
                value={form.grupo}
                onChange={set('grupo')}
              />
            ) : (
              <select
                className={`${inputCls} appearance-none pr-10 cursor-pointer`}
                value={form.grupo}
                onChange={set('grupo')}
                required
              >
                <option value="">— Selecciona un grupo —</option>
                {GRUPOS.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            )}
            {!isCuidador && (
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <ChevronDown size={16} className="text-slate-400" />
              </div>
            )}
          </div>
        </Field>

        {/* Campos Condicionales (Niños vs Cuidadores) */}
        {!isCuidador ? (
          <>
            {/* Edad + Sexo */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Edad" icon={<Baby size={12} />}>
                <input
                  type="number"
                  min="1"
                  max="18"
                  className={inputCls}
                  placeholder="Ej: 9"
                  value={form.edad}
                  onChange={set('edad')}
                />
              </Field>
              <Field label="Sexo" icon={<VenetianMask size={12} />}>
                <div className="relative">
                  <select
                    className={`${inputCls} appearance-none pr-10 cursor-pointer`}
                    value={form.sexo}
                    onChange={set('sexo')}
                  >
                    <option value="">— Opcional —</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    <ChevronDown size={16} className="text-slate-400" />
                  </div>
                </div>
              </Field>
            </div>

            {/* Acudiente */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre Acudiente" icon={<User size={12} />}>
                <input
                  className={inputCls}
                  placeholder="Ej: Carlos García"
                  value={form.acudiente_nombre}
                  onChange={set('acudiente_nombre')}
                />
              </Field>
              <Field label="Teléfono" icon={<Phone size={12} />}>
                <input
                  type="tel"
                  className={inputCls}
                  placeholder="Ej: 300-000-0000"
                  value={form.acudiente_telefono}
                  onChange={set('acudiente_telefono')}
                />
              </Field>
            </div>

            {/* Observaciones médicas */}
            <Field label="Observaciones médicas" icon={<ShieldAlert size={12} />}>
              <textarea
                rows={2}
                className={`${inputCls} resize-none`}
                placeholder="Alergias, condición especial, instrucciones... (opcional)"
                value={form.observaciones}
                onChange={set('observaciones')}
              />
            </Field>
          </>
        ) : (
          <>
            {/* Teléfono Cuidadores */}
            <Field label="Teléfono (Opcional)" icon={<Phone size={12} />}>
              <input
                type="tel"
                className={inputCls}
                placeholder="Ej: 300-000-0000"
                value={form.acudiente_telefono}
                onChange={set('acudiente_telefono')}
              />
            </Field>
            
            {/* Rol Cuidadores */}
            <Field label="Rol Específico (Opcional)" icon={<ShieldAlert size={12} />}>
              <input
                className={inputCls}
                placeholder="Ej: Encargado de sonido, Guardia..."
                value={form.observaciones}
                onChange={set('observaciones')}
              />
            </Field>
          </>
        )}

        {/* Feedback */}
        {result && (
          <div
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm font-medium animate-in fade-in duration-200
              ${result.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'}`}
          >
            {result.type === 'success'
              ? <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              : <AlertCircle size={18} className="text-rose-500 flex-shrink-0 mt-0.5" />}
            <span className="flex-1">{result.text}</span>
            <button type="button" onClick={() => setResult(null)} className="flex-shrink-0 opacity-50 hover:opacity-100">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-black py-4 rounded-2xl transition-all shadow-md shadow-indigo-200 active:scale-[0.98] flex items-center justify-center gap-2 text-base"
        >
          {saving
            ? <><Loader2 size={18} className="animate-spin" /> Guardando...</>
            : <><UserPlus size={18} /> Guardar Niño</>}
        </button>
      </form>
    </div>
  );
}

// ─── Sección 2: Importación masiva (mejorada) ─────────────────────────────────
function BulkImport() {
  const [dataText, setDataText] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleImport = async () => {
    if (!dataText.trim()) {
      setMessage({ type: 'error', text: 'Pega los datos antes de importar.' });
      return;
    }
    setLoading(true);
    setMessage(null);

    try {
      const lines = dataText.split('\n').filter(l => l.trim().length > 0);
      const rows: object[] = [];

      for (const line of lines) {
        const cols = line.split(/[,;\t]+/).map(c => c.trim());
        // Formato esperado: nombre, apellido, grupo, [edad], [sexo], [acudiente_nombre], [acudiente_telefono]
        if (cols.length >= 3) {
          rows.push({
            nombre:             cols[0],
            apellido:           cols[1],
            grupo:              cols[2].toUpperCase(),
            edad:               cols[3] ? parseInt(cols[3]) || null : null,
            sexo:               cols[4] || null,
            acudiente_nombre:   cols[5] || null,
            acudiente_telefono: cols[6] || null,
          });
        }
      }

      if (rows.length === 0) throw new Error('No se encontraron registros válidos. Verifica el formato.');

      const { error } = await supabase.from('ninos').insert(rows);
      if (error) throw error;

      setMessage({ type: 'success', text: `¡Se importaron ${rows.length} niños correctamente!` });
      setDataText('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
      <h2 className="text-lg font-black text-slate-800 mb-1 flex items-center gap-2">
        <Upload className="text-slate-500" size={20} />
        Importación Masiva (Excel/CSV)
      </h2>
      <p className="text-xs text-slate-500 mb-4 font-medium leading-relaxed">
        Pega filas separadas por coma, punto y coma o tabulación. Formato:<br />
        <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">
          Nombre, Apellido, Grupo, Edad, Sexo, Acudiente, Teléfono
        </code>
      </p>

      <textarea
        className="w-full h-36 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none font-mono text-xs shadow-inner transition-all placeholder:text-slate-300"
        placeholder={"Juan, Pérez, GORKA, 9, M, Carlos Pérez, 300-000-0001\nAna, López, STEPHANY, 8, F, María López, 300-000-0002"}
        value={dataText}
        onChange={e => setDataText(e.target.value)}
      />

      {message && (
        <div className={`mt-3 p-3 rounded-xl flex items-start gap-2 border text-sm font-medium
          ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
          {message.type === 'success'
            ? <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
            : <AlertCircle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />}
          {message.text}
        </div>
      )}

      <button
        onClick={handleImport}
        disabled={loading}
        className="mt-4 w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
      >
        {loading ? <><Loader2 size={16} className="animate-spin" /> Importando...</> : <><Upload size={16} /> Importar Datos</>}
      </button>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DataImport() {
  return (
    <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-6">
      <QuickAddForm />
      <BulkImport />
    </div>
  );
}
