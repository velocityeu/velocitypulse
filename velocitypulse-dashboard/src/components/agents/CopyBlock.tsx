'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CopyBlockProps {
  code: string
  language?: string
}

export function CopyBlock({ code, language }: CopyBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group rounded-lg bg-zinc-950 text-zinc-100 text-sm font-mono">
      {language && (
        <div className="px-4 pt-2 text-xs text-zinc-500">{language}</div>
      )}
      <div className="p-4 pr-12 overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  )
}
