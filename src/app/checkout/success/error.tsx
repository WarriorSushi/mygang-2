'use client'
export default function CheckoutSuccessError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">Your payment is safe. Please try refreshing.</p>
        <button onClick={reset} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">Try again</button>
      </div>
    </div>
  )
}
