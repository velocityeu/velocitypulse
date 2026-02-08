'use client'

import { useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

export default function ReportsPage() {
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [status, setStatus] = useState('all')
  const [downloading, setDownloading] = useState(false)

  const handleExport = async () => {
    setDownloading(true)
    try {
      const params = new URLSearchParams({ format, status })
      const response = await authFetch(`/api/dashboard/reports/devices?${params}`)

      if (format === 'csv') {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `devices-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `devices-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Device Export</CardTitle>
          <CardDescription>Export your device inventory as CSV or JSON</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="text-sm font-medium mb-1 block">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as 'csv' | 'json')}
                className="rounded-md border px-3 py-2 text-sm bg-background"
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Status Filter</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm bg-background"
              >
                <option value="all">All Devices</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="degraded">Degraded</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>
          <Button onClick={handleExport} disabled={downloading}>
            <Download className="h-4 w-4 mr-2" />
            {downloading ? 'Exporting...' : 'Export Devices'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
