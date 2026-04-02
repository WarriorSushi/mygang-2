'use client'

import dynamic from 'next/dynamic'
import loaderData from '../../../public/lottie/loader.json'

const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

interface LottieLoaderProps {
    size?: number
    className?: string
    loop?: boolean
}

export function LottieLoader({ size = 120, className = '', loop = true }: LottieLoaderProps) {
    return (
        <Lottie
            animationData={loaderData}
            loop={loop}
            autoplay
            style={{ width: size, height: size }}
            className={className}
        />
    )
}
