import { Nino, Asistencia } from '@/types';
import { format } from 'date-fns';

const todayStr = format(new Date(), 'yyyy-MM-dd');

export const MOCK_NINOS: Nino[] = [
  { id: '1',  nombre: 'Santiago',   apellido: 'García',     grupo: 'Stephany', edad: 8,  sexo: 'M', observaciones: 'Alérgico al maní y al látex. Llevar EpiPen disponible.', acudiente_nombre: 'María García',      acudiente_telefono: '300-111-0001' },
  { id: '2',  nombre: 'Valentina',  apellido: 'Martínez',   grupo: 'Andrea',   edad: 9,  sexo: 'F', observaciones: '',                                                       acudiente_nombre: 'Juan Martínez',     acudiente_telefono: '300-111-0002' },
  { id: '3',  nombre: 'Samuel',     apellido: 'Rodríguez',  grupo: 'Juliana',  edad: 7,  sexo: 'M', observaciones: 'Autismo leve. Necesita rutinas claras y espacio personal.',  acudiente_nombre: 'Laura Rodríguez',   acudiente_telefono: '' },
  { id: '4',  nombre: 'Isabella',   apellido: 'López',      grupo: 'Sain',     edad: 10, sexo: 'F', observaciones: '',                                                       acudiente_nombre: 'Carlos López',      acudiente_telefono: '300-111-0004' },
  { id: '5',  nombre: 'Daniel',     apellido: 'Hernández',  grupo: 'Gorka',    edad: 11, sexo: 'M', observaciones: 'Diabetes tipo 1. Monitorear glucosa antes del almuerzo.',  acudiente_nombre: '',                  acudiente_telefono: '' },
  { id: '6',  nombre: 'Salomé',     apellido: 'Torres',     grupo: 'Stephany', edad: 8,  sexo: 'F', observaciones: '',                                                       acudiente_nombre: 'Pedro Torres',      acudiente_telefono: '300-111-0006' },
  { id: '7',  nombre: 'Mateo',      apellido: 'Vargas',     grupo: 'Andrea',   edad: 9,  sexo: 'M', observaciones: 'Alérgico al gluten. Cuidado con el refrigerio.',          acudiente_nombre: 'Elena Vargas',      acudiente_telefono: '300-111-0007' },
  { id: '8',  nombre: 'Luciana',    apellido: 'Díaz',       grupo: 'Juliana',  edad: 7,  sexo: 'F', observaciones: '',                                                       acudiente_nombre: 'Roberto Díaz',      acudiente_telefono: '' },
  { id: '9',  nombre: 'Juan Pablo', apellido: 'Moreno',     grupo: 'Sain',     edad: 10, sexo: 'M', observaciones: '',                                                       acudiente_nombre: '',                  acudiente_telefono: '' },
  { id: '10', nombre: 'Mariana',    apellido: 'Jiménez',    grupo: 'Gorka',    edad: 11, sexo: 'F', observaciones: '',                                                       acudiente_nombre: 'Andrés Jiménez',    acudiente_telefono: '300-111-0010' },
  { id: '11', nombre: 'Tomás',      apellido: 'Ruiz',       grupo: 'Stephany', edad: 8,  sexo: 'M', observaciones: 'Crisis de ansiedad frecuentes. Contactar acudiente si se altera.', acudiente_nombre: 'Claudia Ruiz', acudiente_telefono: '300-111-0011' },
  { id: '12', nombre: 'Gabriela',   apellido: 'Ramírez',    grupo: 'Andrea',   edad: 9,  sexo: 'F', observaciones: '',                                                       acudiente_nombre: '',                  acudiente_telefono: '' },
];

export const MOCK_ASISTENCIAS: Record<string, Asistencia> = {
  '1':  { id: 'a1',  nino_id: '1',  fecha: todayStr, asistio: true  },
  '2':  { id: 'a2',  nino_id: '2',  fecha: todayStr, asistio: true  },
  '3':  { id: 'a3',  nino_id: '3',  fecha: todayStr, asistio: false },
  '5':  { id: 'a5',  nino_id: '5',  fecha: todayStr, asistio: true  },
  '7':  { id: 'a7',  nino_id: '7',  fecha: todayStr, asistio: true  },
  '9':  { id: 'a9',  nino_id: '9',  fecha: todayStr, asistio: false },
  '11': { id: 'a11', nino_id: '11', fecha: todayStr, asistio: true  },
};

/**
 * Returns true when running without real Supabase credentials.
 * In that case, all components should use mock data instead of hitting the DB.
 */
export const IS_MOCK_MODE =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
