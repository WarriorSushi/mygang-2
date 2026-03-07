import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import DodoPayments from 'dodopayments'

loadEnvConfig(process.cwd())

const applyChanges = process.argv.includes('--apply')
const safePaidStatuses = new Set(['active', 'trialing'])
const paidTiers = new Set(['basic', 'pro'])

function requireEnv(name) {
    const value = process.env[name]
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`)
    }
    return value
}

function getPlanFromProductId(productId) {
    if (productId === process.env.DODO_PRODUCT_PRO) return 'pro'
    if (productId === process.env.DODO_PRODUCT_BASIC) return 'basic'
    return null
}

function pickWinningSubscription(subscriptions) {
    return [...subscriptions].sort((left, right) => {
        const leftPlanWeight = getPlanFromProductId(left.product_id) === 'pro' ? 2 : 1
        const rightPlanWeight = getPlanFromProductId(right.product_id) === 'pro' ? 2 : 1
        if (leftPlanWeight !== rightPlanWeight) return rightPlanWeight - leftPlanWeight
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    })[0] || null
}

async function main() {
    const supabase = createClient(
        requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
        requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const dodo = new DodoPayments({
        bearerToken: requireEnv('DODO_PAYMENTS_API_KEY'),
        environment: process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode',
    })

    const [{ data: profiles, error: profilesError }, { data: localSubscriptions, error: subsError }] = await Promise.all([
        supabase
            .from('profiles')
            .select('id, username, subscription_tier, dodo_customer_id')
            .not('dodo_customer_id', 'is', null),
        supabase
            .from('subscriptions')
            .select('id, user_id, plan, status, product_id'),
    ])

    if (profilesError) throw profilesError
    if (subsError) throw subsError

    const localSubscriptionsById = new Map((localSubscriptions || []).map((subscription) => [subscription.id, subscription]))
    const report = {
        mode: applyChanges ? 'apply' : 'dry-run',
        checkedProfiles: 0,
        backfilledSubscriptions: [],
        upgradedProfiles: [],
        orphanedPaidProfiles: [],
        unknownRemoteProducts: [],
        remoteLookupFailures: [],
    }

    for (const profile of profiles || []) {
        report.checkedProfiles += 1
        const customerId = profile.dodo_customer_id
        if (!customerId) continue

        const remoteSubscriptions = []
        try {
            for await (const subscription of dodo.subscriptions.list({ customer_id: customerId, page_size: 100 })) {
                remoteSubscriptions.push(subscription)
            }
        } catch (error) {
            report.remoteLookupFailures.push({
                userId: profile.id,
                customerId,
                error: error instanceof Error ? error.message : 'Unknown error',
            })
            continue
        }

        const paidRemoteSubscriptions = remoteSubscriptions.filter((subscription) => safePaidStatuses.has(subscription.status))
        const remoteWithKnownProducts = paidRemoteSubscriptions.filter((subscription) => {
            const plan = getPlanFromProductId(subscription.product_id)
            if (plan) return true
            report.unknownRemoteProducts.push({
                userId: profile.id,
                subscriptionId: subscription.subscription_id,
                productId: subscription.product_id,
                status: subscription.status,
            })
            return false
        })

        if (remoteWithKnownProducts.length === 0) {
            if (paidTiers.has(profile.subscription_tier || '')) {
                report.orphanedPaidProfiles.push({
                    userId: profile.id,
                    username: profile.username,
                    localTier: profile.subscription_tier,
                    customerId,
                    remoteStatuses: remoteSubscriptions.map((subscription) => ({
                        subscriptionId: subscription.subscription_id,
                        status: subscription.status,
                        productId: subscription.product_id,
                    })),
                })
            }
            continue
        }

        for (const remoteSubscription of remoteWithKnownProducts) {
            if (localSubscriptionsById.has(remoteSubscription.subscription_id)) continue

            const plan = getPlanFromProductId(remoteSubscription.product_id)
            if (!plan) continue

            const payload = {
                id: remoteSubscription.subscription_id,
                user_id: profile.id,
                product_id: remoteSubscription.product_id,
                plan,
                status: remoteSubscription.status,
                current_period_end: remoteSubscription.next_billing_date ?? null,
                updated_at: new Date().toISOString(),
            }

            if (applyChanges) {
                const { error } = await supabase.from('subscriptions').upsert(payload)
                if (error) throw error
            }

            report.backfilledSubscriptions.push({
                userId: profile.id,
                subscriptionId: payload.id,
                plan: payload.plan,
                status: payload.status,
            })
            localSubscriptionsById.set(payload.id, payload)
        }

        const winningSubscription = pickWinningSubscription(remoteWithKnownProducts)
        const winningPlan = winningSubscription ? getPlanFromProductId(winningSubscription.product_id) : null
        if (!winningPlan) continue

        if (profile.subscription_tier !== winningPlan) {
            if (applyChanges) {
                const { error } = await supabase
                    .from('profiles')
                    .update({ subscription_tier: winningPlan })
                    .eq('id', profile.id)
                if (error) throw error
            }

            report.upgradedProfiles.push({
                userId: profile.id,
                username: profile.username,
                from: profile.subscription_tier,
                to: winningPlan,
                subscriptionId: winningSubscription.subscription_id,
            })
        }
    }

    console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
    console.error('[reconcile-billing] Failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
})
