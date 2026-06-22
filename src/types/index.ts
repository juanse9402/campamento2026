export interface Nino {
  id: string;
  nombre: string;
  apellido: string;
  grupo: string;
  edad?: number;
  sexo?: string;
  observaciones?: string;
  acudiente_nombre?: string;
  acudiente_telefono?: string;
  // legacy aliases kept for mock data compatibility
  acudiente?: string;
  telefono?: string;
}

export interface Asistencia {
  id: string;
  nino_id: string;
  fecha: string;
  /** Columna real en Supabase: 'asistio' */
  asistio: boolean;
}

export interface Cuidador {
  id: string;
  nombre: string;
  apellido: string;
  grupo?: string;
  telefono?: string;
  rol?: string;
}

export interface AsistenciaCuidador {
  id: string;
  cuidador_id: string;
  fecha: string;
  asistio: boolean;
}
