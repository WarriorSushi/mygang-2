import { createClient } from '@/lib/supabase/server'
import { getDodoClient } from '@/lib/billing'

export async function POST(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const subscriptionId = body.subscription_id as string

    if (!subscriptionId) {
        return Response.json({ error: 'Missing subscription_id' }, { status: 400 })
    }

    try {
        const dodo = getDodoClient()
        const subscription = await dodo.subscriptions.retrieve(subscriptionId) as unknown as Record<string, unknown>

        if (!subscription) {
            return Response.json({ error: 'Subscription not found' }, { status: 404 })
        }

        // Determine plan from product ID
        const productId = (subscription.product_id as string) || ''
        const plan = productId === process.env.DODO_PRODUCT_PRO ? 'pro' : 'basic'

        // Update profile tier immediately
        await supabase
            .from('profiles')
            .update({ subscription_tier: plan })
            .eq('id', user.id)

        // Upsert subscription record
        await supabase.from('subscriptions').upsert({
            id: subscriptionId,
            user_id: user.id,
            product_id: productId,
            plan,
            status: 'active',
            updated_at: new Date().toISOString(),
        })

        return Response.json({ success: true, plan })
    } catch (error) {
        console.error('[activate] Error:', error)
        return Response.json({ error: 'Activation failed' }, { status: 500 })
    }
}
