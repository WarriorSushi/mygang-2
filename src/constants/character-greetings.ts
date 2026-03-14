export const CHARACTER_GREETINGS: Record<string, string[]> = {
    kael: [
        "yooo {name}! ok first things first, what do you do? like for work or school or whatever",
        "ayyy {name}'s here! tell me about yourself, what are you into?",
        "ok {name} we gotta get to know you. what's your vibe? what do you do all day?"
    ],
    nyx: [
        "hey {name}. so what's your deal? what do you do?",
        "alright {name}, give me the basics. what are you into?",
        "ok {name} i need context. what do you do and what's going on in your life rn?"
    ],
    atlas: [
        "hey {name}. good to meet you. so what do you do? work, school, something else?",
        "alright {name}, let's start simple. tell me a bit about yourself.",
        "{name}, welcome. what's your day to day like? what keeps you busy?"
    ],
    luna: [
        "hiii {name}! i wanna know everything about you. what do you do? what makes you happy?",
        "hey {name}, tell me about yourself! what's your life like rn?",
        "aww {name} i'm so glad you're here. what are you into? what do you care about?"
    ],
    rico: [
        "YOOO {name}!! what do you do?? tell me everything lol",
        "{name}!! ok ok ok what's your thing? what are you about?",
        "ayyy {name} let's goooo. so what do you do? school? work? chaos?"
    ],
    vee: [
        "Hey {name}. Come here, angel. You're cute already, so tell me everything. What do you do?",
        "{name}, hi. What are you into? What takes up your time? I want all your little details.",
        "Alright {name}, come talk to me. What do you do, what do you love, and what should I memorize about you?"
    ],
    ezra: [
        "hey {name}... tell me about yourself. what do you do? what are you passionate about?",
        "{name}, i'm curious about you. what's your story?",
        "so {name}, what's your life like? what do you care about most?"
    ],
    cleo: [
        "ok {name} spill. what do you do? i need the full picture.",
        "{name}! tell me about yourself. what's your thing? what are you into?",
        "alright {name} let's get to know each other. what do you do all day?"
    ],
    sage: [
        "hey {name}, nice to meet you. what do you do? tell me a bit about yourself.",
        "{name}, i'd love to get to know you. what's your life like right now?",
        "hey {name}. so what keeps you busy? what are you into?"
    ],
    miko: [
        "{name}!! ok tell me EVERYTHING. what do you do? what are you into?!",
        "YOOO {name}! what's your deal? school? work? i need the lore!",
        "{name}!! ok first question, what do you do? second question, what's your favorite thing ever?"
    ],
    dash: [
        "{name}, let's go. tell me about yourself. what do you do?",
        "hey {name}. what's your grind? what keeps you busy?",
        "alright {name}, what do you do? what are you working on these days?"
    ],
    zara: [
        "hey {name}. so tell me about yourself. what do you do?",
        "{name}, i wanna know the real you. what's your life like?",
        "ok {name}, give me the rundown. what do you do? what's going on with you?"
    ],
    jinx: [
        "{name}... interesting. so what do you do? what's your deal?",
        "ok {name}, i'm curious. tell me about yourself. what are you into?",
        "{name}... before we go further, what do you do? i need to know who i'm dealing with."
    ],
    nova: [
        "heyyy {name}... so like what do you do? tell me about yourself",
        "{name}... ok i wanna know everything. what's your vibe? what do you do?",
        "oh cool {name}'s here. so what are you into? what do you do?"
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
