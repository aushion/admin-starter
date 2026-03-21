import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export function exportToExcel<T extends Record<string, any>>(
  rows: T[],
  options: {
    filename?: string
    sheetName?: string
    header?: { key: keyof T; title: string }[]
  } = {},
) {
  const filename = options.filename ?? 'export.xlsx'
  const sheetName = options.sheetName ?? 'Sheet1'

  const data = options.header
    ? [options.header.map((h) => h.title), ...rows.map((r) => options.header!.map((h) => r[h.key]))]
    : rows

  const ws = XLSX.utils.aoa_to_sheet(data as any)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([out], { type: 'application/octet-stream' }), filename)
}
