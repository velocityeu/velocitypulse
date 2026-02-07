'use client'

import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PLANS } from '@/lib/constants'

interface PlanCardsProps {
  currentPlan?: string
  onSelectPlan: (planId: string, priceId: string | null) => void
  loading?: string | null
  showTrialCard?: boolean
}

export function PlanCards({ currentPlan, onSelectPlan, loading, showTrialCard = true }: PlanCardsProps) {
  const visiblePlans = showTrialCard ? PLANS : PLANS.filter(p => p.id !== 'trial')

  return (
    <div className={`grid gap-8 max-w-6xl mx-auto ${visiblePlans.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
      {visiblePlans.map((plan) => {
        const isCurrent = plan.id === currentPlan
        const isPopular = 'popular' in plan && plan.popular

        return (
          <Card
            key={plan.id}
            className={`relative ${isPopular ? 'border-primary border-2' : ''}`}
          >
            {isPopular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                Most Popular
              </Badge>
            )}

            <CardHeader>
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
            </CardHeader>

            <CardContent>
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-status-online shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              {isCurrent ? (
                <Button className="w-full" variant="outline" disabled>
                  Current Plan
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant={isPopular ? 'default' : 'outline'}
                  onClick={() => onSelectPlan(plan.id, plan.priceId)}
                  disabled={loading !== null && loading !== undefined}
                >
                  {loading === plan.id ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </span>
                  ) : plan.priceId ? (
                    `Subscribe to ${plan.name}`
                  ) : (
                    'Start Free Trial'
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
