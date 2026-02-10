import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/session'

export default async function AdminRootPage() {
    const session = await getAdminSession()
    if (session) {
        redirect('/admin/overview')
    }
    redirect('/admin/login')
}
