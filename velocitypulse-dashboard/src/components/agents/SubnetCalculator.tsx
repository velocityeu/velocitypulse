'use client'

import { useState } from 'react'
import { Calculator } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface SubnetInfo {
  network: string
  broadcast: string
  firstHost: string
  lastHost: string
  totalHosts: number
  usableHosts: number
  subnetMask: string
  cidr: number
}

function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
}

function numberToIp(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255,
  ].join('.')
}

function calculateSubnet(cidrInput: string): SubnetInfo | null {
  const match = cidrInput.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/)
  if (!match) return null

  const ip = match[1]
  const prefix = parseInt(match[2], 10)

  if (prefix < 0 || prefix > 32) return null

  const parts = ip.split('.').map(Number)
  if (parts.some(p => p < 0 || p > 255)) return null

  const ipNum = ipToNumber(ip)
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
  const network = (ipNum & mask) >>> 0
  const broadcast = (network | ~mask) >>> 0
  const totalHosts = Math.pow(2, 32 - prefix)
  const usableHosts = prefix >= 31 ? totalHosts : totalHosts - 2

  return {
    network: numberToIp(network),
    broadcast: numberToIp(broadcast),
    firstHost: prefix >= 31 ? numberToIp(network) : numberToIp(network + 1),
    lastHost: prefix >= 31 ? numberToIp(broadcast) : numberToIp(broadcast - 1),
    totalHosts,
    usableHosts: Math.max(0, usableHosts),
    subnetMask: numberToIp(mask),
    cidr: prefix,
  }
}

interface SubnetCalculatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SubnetCalculator({ open, onOpenChange }: SubnetCalculatorProps) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<SubnetInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCalculate = () => {
    setError(null)
    const info = calculateSubnet(input.trim())
    if (!info) {
      setError('Invalid CIDR notation (e.g., 192.168.1.0/24)')
      setResult(null)
      return
    }
    setResult(info)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Subnet Calculator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="192.168.1.0/24"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCalculate()}
              className="font-mono"
            />
            <Button onClick={handleCalculate}>
              Calculate
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {result && (
            <div className="space-y-2 font-mono text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">Network:</span>
                <span>{result.network}/{result.cidr}</span>
                <span className="text-muted-foreground">Subnet Mask:</span>
                <span>{result.subnetMask}</span>
                <span className="text-muted-foreground">Broadcast:</span>
                <span>{result.broadcast}</span>
                <span className="text-muted-foreground">First Host:</span>
                <span>{result.firstHost}</span>
                <span className="text-muted-foreground">Last Host:</span>
                <span>{result.lastHost}</span>
                <span className="text-muted-foreground">Total IPs:</span>
                <span>{result.totalHosts.toLocaleString()}</span>
                <span className="text-muted-foreground">Usable Hosts:</span>
                <span>{result.usableHosts.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
