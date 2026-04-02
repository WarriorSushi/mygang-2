import { ResetPasswordPageClient } from '@/components/auth/reset-password-page-client'

type ResetPasswordPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
    const params = await searchParams
    const errorRaw = params.error
    const errorCode = Array.isArray(errorRaw) ? errorRaw[0] : errorRaw || null

    return <ResetPasswordPageClient initialErrorCode={errorCode} />
}
