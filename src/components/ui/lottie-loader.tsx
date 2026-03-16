'use client'

import Lottie from 'lottie-react'
import loaderData from '../../../public/lottie/loader.json'

interface LottieLoaderProps {
    size?: number
    className?: string
}

export function LottieLoader({ size = 120, className = '' }: LottieLoaderProps) {
    return (
        <Lottie
            animationData={loaderData}
            loop={false}
            autoplay
            style={{ width: size, height: size }}
            className={className}
        />
    )
}
