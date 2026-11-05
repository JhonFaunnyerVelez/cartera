import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase/config';
import type { ComprobanteAliado } from '../types';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const TIPOS_OK = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

function sanitizarNombre(nombre: string) {
  return nombre.replace(/[^\w.\-()\sáéíóúÁÉÍÓÚñÑ]/g, '_').slice(0, 120);
}

export async function subirComprobantesAliado(
  files: File[],
  opts: { aliadoId: string; mes: number; anio: number },
): Promise<ComprobanteAliado[]> {
  const resultados: ComprobanteAliado[] = [];

  for (const file of files) {
    if (!TIPOS_OK.has(file.type)) {
      throw new Error(`"${file.name}" no es imagen ni PDF.`);
    }
    if (file.size > MAX_BYTES) {
      throw new Error(`"${file.name}" supera 8 MB.`);
    }

    const safe = sanitizarNombre(file.name) || 'comprobante';
    const path = `comprobantes_aliados/${opts.aliadoId}/${opts.anio}-${String(opts.mes).padStart(2, '0')}/${Date.now()}_${safe}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const url = await getDownloadURL(storageRef);

    resultados.push({
      url,
      nombre: file.name,
      contentType: file.type,
      path,
      size: file.size,
    });
  }

  return resultados;
}

export function esImagenComprobante(c: Pick<ComprobanteAliado, 'contentType' | 'nombre'>) {
  if (c.contentType?.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(c.nombre || '');
}

export async function borrarComprobanteStorage(path?: string) {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    console.warn('No se pudo borrar el archivo del storage:', err);
  }
}
