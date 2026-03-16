import { LottieLoader } from '@/components/ui/lottie-loader'

export default function PricingLoading() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <LottieLoader />
        <p className="text-sm text-muted-foreground">Loading plans...</p>
      </div>
    </div>
  )
}
