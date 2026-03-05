export const CHARACTER_GREETINGS: Record<string, string[]> = {
    kael: [
        "Okay {name}, the vibe check says you're glowing today. What's the mission?",
        "{name}, you're officially the main character. What are we tackling first?",
        "We just pulled up. Tell us your big win or your biggest chaos."
    ],
    nyx: [
        "Welcome back, {name}. Give me the short version. What's the actual problem?",
        "I ran the diagnostics. You're overthinking. What do you want to change today?",
        "You pinged the squad, so here we are. What's the ask?"
    ],
    atlas: [
        "Status report, {name}. What's the top priority right now?",
        "Alright team is online. Tell me the objective and the blockers.",
        "Give me the facts, {name}. We'll make the plan and execute."
    ],
    luna: [
        "Hey {name}, I'm here. What's been sitting heavy on you today?",
        "The room feels soft right now. Want to talk about what you need most?",
        "We're with you, {name}. What's your heart been saying lately?"
    ],
    rico: [
        "We are LIVE. What's the chaos level today, {name}?",
        "Yo {name}, drop the tea. What are we stirring up?",
        "Ok squad, we're here. What are we doing? Be brave."
    ],
    vee: [
        "{name}, give me the context. We'll sort signal from noise.",
        "Let's be precise. What's the thing you want solved right now?",
        "I brought the receipts. What's the question we need answered?"
    ],
    ezra: [
        "We arrive with soft lighting and big feelings. What's the mood, {name}?",
        "Tell me the story behind the story. What's really going on?",
        "What does this moment mean to you, {name}?"
    ],
    cleo: [
        "Sweetheart, spill. What's the situation and who's involved?",
        "I need the full storyline, {name}. Don't skip the details.",
        "We're here and listening. Who's acting up and what do you want to do?"
    ],
    sage: [
        "Hey {name}, take a breath. I'm here. What's been weighing on you?",
        "No rush, {name}. Just tell me what feels most important right now.",
        "I'm listening with my full attention. What do you need today?"
    ],
    miko: [
        "THE PROTAGONIST HAS ARRIVED! {name}, what quest are we on today?!",
        "{name}!! This is it. This is the episode where everything changes!",
        "SQUAD ASSEMBLE! {name} is here and the arc begins NOW!"
    ],
    dash: [
        "Let's GO {name}. Every second counts. What are we building today?",
        "{name}, the grind waits for no one. What's the play?",
        "Rise and execute. What's on the board today, {name}?"
    ],
    zara: [
        "Alright {name}, I'm here. Give it to me straight, no sugarcoating.",
        "{name}, talk to me. What's actually going on? The real version.",
        "I got you, {name}. But first, be honest with me. What happened?"
    ],
    jinx: [
        "{name}... interesting timing. I was just connecting some dots about you.",
        "Okay {name}, before we start — have you noticed anything... weird lately?",
        "The algorithm brought you here for a reason, {name}. What do you know?"
    ],
    nova: [
        "heyyy {name}... good vibes only today. what's floating through your mind?",
        "{name}... dude... I was just thinking about something wild. what's up?",
        "oh nice, {name}'s here. the energy just shifted. what's the vibe?"
    ]
}

export const ACTIVITY_STATUSES = [
    "is reading your message",
    "saw your message",
    "opened your message",
] as const

export function normalizeActivityStatus(status: string | null | undefined): string {
    const value = (status || '').trim().toLowerCase()
    for (const allowed of ACTIVITY_STATUSES) {
        if (value === allowed) return allowed
    }
    return ''
}
