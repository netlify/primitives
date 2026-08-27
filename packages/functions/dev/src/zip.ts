import { once } from 'node:events'
import { constants as fsConstants, createWriteStream } from 'node:fs'
import { mkdir, realpath, symlink } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { buffer } from 'node:stream/consumers'
import { pipeline } from 'node:stream/promises'

import { type Entry, openPromise, type ZipFile } from 'yauzl'

const DOS_DIRECTORY_ATTRIBUTE = 0x10

// ZIP stores the Unix mode in the upper 16 bits of external attributes.
const getEntryMode = (entry: Entry) => (entry.externalFileAttributes >> 16) & 0xffff

const isDirectoryEntry = (entry: Entry, mode: number) => {
  if ((mode & fsConstants.S_IFMT) === fsConstants.S_IFDIR || entry.fileName.endsWith('/')) {
    return true
  }

  // The upper byte identifies the platform that created the entry.
  const madeBy = entry.versionMadeBy >> 8

  // DOS archives can mark directories only through the external attributes field.
  return madeBy === 0 && entry.externalFileAttributes === DOS_DIRECTORY_ATTRIBUTE
}

const extractEntry = async (zipFile: ZipFile, entry: Entry, targetDirectory: string) => {
  const destination = join(targetDirectory, entry.fileName)
  const destinationDirectory = dirname(destination)

  await mkdir(destinationDirectory, { recursive: true })

  const canonicalDestinationDirectory = await realpath(destinationDirectory)
  const relativeDestinationDirectory = relative(targetDirectory, canonicalDestinationDirectory)

  if (relativeDestinationDirectory.split(sep).includes('..')) {
    throw new Error(
      `Out of bound path "${canonicalDestinationDirectory}" found while processing file ${entry.fileName}`,
    )
  }

  const mode = getEntryMode(entry)
  const isDirectory = isDirectoryEntry(entry, mode)
  // Strip file-type bits before passing permissions to the filesystem.
  const extractedMode = (mode || (isDirectory ? 0o755 : 0o644)) & 0o777

  if (isDirectory) {
    await mkdir(destination, { mode: extractedMode, recursive: true })
    return
  }

  const readStream = await zipFile.openReadStreamPromise(entry)

  if ((mode & fsConstants.S_IFMT) === fsConstants.S_IFLNK) {
    await symlink((await buffer(readStream)).toString('utf8'), destination)
    return
  }

  await pipeline(readStream, createWriteStream(destination, { mode: extractedMode }))
}

export const extractZip = async (archivePath: string, targetDirectory: string) => {
  await mkdir(targetDirectory, { recursive: true })

  const canonicalTargetDirectory = await realpath(targetDirectory)
  const zipFile = await openPromise(archivePath, { autoClose: false })
  const closePromise = once(zipFile, 'close')

  try {
    for await (const entry of zipFile.eachEntry()) {
      if (!entry.fileName.startsWith('__MACOSX/')) {
        await extractEntry(zipFile, entry, canonicalTargetDirectory)
      }
    }
  } finally {
    zipFile.close()
    await closePromise
  }
}
