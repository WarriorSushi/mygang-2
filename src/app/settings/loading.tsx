import { LottieLoader } from '@/components/ui/lottie-loader'

export default function SettingsLoading() {
    return (
        <div className="flex min-h-dvh items-center justify-center bg-background" role="status" aria-label="Loading settings">
            <LottieLoader />
        </div>
    )
}
