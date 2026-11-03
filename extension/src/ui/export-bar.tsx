import { Button } from './components/button'

export interface ExportFile {
  readonly label: string
  readonly filename: string
  readonly mime: string
  readonly text: () => string
}

/** Saves a result as a file on the user's device; nothing is uploaded. */
export function ExportBar({ files }: { readonly files: readonly ExportFile[] }) {
  const save = (file: ExportFile) => {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([file.text()], { type: file.mime }))
    link.download = file.filename
    link.click()
    URL.revokeObjectURL(link.href)
  }
  return (
    <>
      {files.map((file) => (
        <Button key={file.label} variant="ghost" onClick={() => save(file)}>
          {file.label}
        </Button>
      ))}
    </>
  )
}

/** A file name from a business or search name: "south-austin-dentist-audit.md". */
export function fileName(name: string, kind: string, extension: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'local-seo'}-${kind}.${extension}`
}
