'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics'

const STORAGE_KEY = 'perf_monitoring'

export function PerfMonitor() {
    useEffect(() => {
        const isProd = process.env.NODE_ENV === 'production'
        if (!isProd) return

        const enabled = typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === 'true'
        if (!enabled) return

        const sendMetric = (name: string, value: number, extra?: Record<string, unknown>) => {
            trackEvent('perf_metric', {
                metadata: { name, value: Math.round(value), ...extra }
            })
        }

        try {
            const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
            if (nav) {
                sendMetric('ttfb', nav.responseStart - nav.requestStart)
                sendMetric('dom_content_loaded', nav.domContentLoadedEventEnd - nav.startTime)
                sendMetric('load', nav.loadEventEnd - nav.startTime)
            }
        } catch {
            // Ignore navigation errors
        }

        if ('PerformanceObserver' in window) {
            try {
                const lcpObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries()
                    const last = entries[entries.length - 1] as PerformanceEntry | undefined
                    if (last) sendMetric('lcp', last.startTime)
                })
                lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })

                const fidObserver = new PerformanceObserver((entryList) => {
                    const firstInput = entryList.getEntries()[0] as PerformanceEventTiming | undefined
                    if (firstInput) {
                        const fid = firstInput.processingStart - firstInput.startTime
                        sendMetric('fid', fid)
                    }
                })
                fidObserver.observe({ type: 'first-input', buffered: true })

                let clsValue = 0
                const clsObserver = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries() as any) {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value
                        }
                    }
                    sendMetric('cls', clsValue * 1000)
                })
                clsObserver.observe({ type: 'layout-shift', buffered: true })

                const longTaskObserver = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        sendMetric('longtask', entry.duration, { name: entry.name || 'longtask' })
                    }
                })
                longTaskObserver.observe({ type: 'longtask', buffered: true })

                return () => {
                    lcpObserver.disconnect()
                    fidObserver.disconnect()
                    clsObserver.disconnect()
                    longTaskObserver.disconnect()
                }
            } catch {
                // Ignore unsupported observers
            }
        }
    }, [])

    return null
}
