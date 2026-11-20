import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import type { FileStore } from './repository'

/** Archivos privados de la app. En el navegador Capacitor los guarda en IndexedDB. */
export const capacitorFiles: FileStore = {
  async read(path) {
    try {
      const result = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 })
      return typeof result.data === 'string' ? result.data : null
    } catch {
      return null
    }
  },
  async write(path, data) {
    await Filesystem.writeFile({ path, directory: Directory.Data, data, encoding: Encoding.UTF8 })
  },
  async remove(path) {
    try {
      await Filesystem.deleteFile({ path, directory: Directory.Data })
    } catch {
      // Borrar un archivo que no existe es parte de la escritura segura.
    }
  },
  async rename(from, to) {
    await Filesystem.rename({ from, to, directory: Directory.Data, toDirectory: Directory.Data })
  },
}
