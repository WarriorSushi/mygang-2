export type GreetingBeat = 'warm_open' | 'riff' | 'useful_question' | 'solo_open'

type GreetingPlan = Record<GreetingBeat, string[]>

export const CHARACTER_GREETINGS: Record<string, GreetingPlan> = {
    kael: {
        warm_open: [
            "yooo {name}, you picked a good-looking little squad. come sit with us.",
            "ayyy {name}'s here. okay wait this lineup actually has chemistry already.",
            "okay {name}, this crew choice? elite. i'm into it."
        ],
        riff: [
            "not to be dramatic but this chat got hotter the second you showed up.",
            "yeah no this squad is already giving dangerous levels of main-character energy.",
            "lowkey obsessed that you threw this exact mix of people together."
        ],
        useful_question: [
            "what are we doing for you today, hype, advice, or just vibes?",
            "give me the brief. what kind of energy do you want from us right now?",
            "what's the move today, be honest. pep talk, chaos, or company?"
        ],
        solo_open: [
            "yooo {name}, welcome in. you picked well. what kind of energy do you want from me today?",
            "ayyy {name}, glad you're here. what are we helping you with first, vibes or actual strategy?",
            "okay {name}, i'm locked in. what do you need most right now, hype or honesty?"
        ],
    },
    nyx: {
        warm_open: [
            "hey {name}. your squad draft is weirdly solid. respect.",
            "alright {name}, you assembled a suspiciously functional little crew here.",
            "hi {name}. not saying i approve easily, but this lineup works."
        ],
        riff: [
            "honestly this group chat should probably be supervised.",
            "this combination of personalities feels like a choice with consequences.",
            "cool, so we're all here making questionable but interesting decisions."
        ],
        useful_question: [
            "what's the actual situation today, stripped of the fluff?",
            "give me the short version. what do you need from us right now?",
            "what are we solving first, the practical thing or the brain-noise thing?"
        ],
        solo_open: [
            "hey {name}. i'm here. give me the actual version of what's going on.",
            "alright {name}, squad's quiet for a second so tell me the real problem first.",
            "hi {name}. what needs attention, specifically?"
        ],
    },
    atlas: {
        warm_open: [
            "welcome in, {name}. this crew is assembled and ready.",
            "good to have you here, {name}. squad selection looks deliberate.",
            "alright {name}, we're online. solid team you put together."
        ],
        riff: [
            "i've seen worse tactical decisions than this lineup.",
            "for once, the chaos appears properly staffed.",
            "this group has range. dangerous in a useful way."
        ],
        useful_question: [
            "what do you need most right now: a plan, perspective, or a distraction?",
            "give us the objective. what's the thing we're helping with first?",
            "where should we focus, your head, your schedule, or the situation itself?"
        ],
        solo_open: [
            "welcome in, {name}. i'm with you. what's the priority right now?",
            "good to have you here, {name}. tell me the objective and we'll move.",
            "{name}, we're set. what kind of help do you need first?"
        ],
    },
    luna: {
        warm_open: [
            "hiii {name}. this little constellation you built is actually so cute.",
            "hey {name}, i'm glad you found your way in here. the vibe is sweet already.",
            "aww {name}, okay this crew feels warm. i love that for us."
        ],
        riff: [
            "it already feels like you picked the exact emotional weather on purpose.",
            "this chat has suspiciously good energy for something that started two seconds ago.",
            "okay wait, the chemistry in here is kind of glowing."
        ],
        useful_question: [
            "what kind of energy do you need around you today?",
            "what would feel good from us right now, comfort, laughs, or a gentle push?",
            "where's your heart at today? we can meet you there."
        ],
        solo_open: [
            "hiii {name}. i'm happy you're here. what kind of energy would feel good right now?",
            "hey {name}, come closer. what do you need from me today, softness, clarity, or comfort?",
            "aww {name}, welcome. where are you at emotionally today?"
        ],
    },
    rico: {
        warm_open: [
            "YOOO {name}!! okay this squad pick is fun as hell already.",
            "{name}!! let's goooo, you really loaded this chat with gremlins and icons.",
            "ayyy {name}, immaculate chaos in here already. i'm in."
        ],
        riff: [
            "this is either gonna be healing or a complete incident.",
            "i can already tell this group chat is one bad idea away from being legendary.",
            "the vibe in here is unreasonably loud for how early this is."
        ],
        useful_question: [
            "what are we on today, drama, jokes, or emotional support with extra volume?",
            "say the word. do you want us helpful or unhelpfully iconic?",
            "what's the assignment, coach? fix your life a little or just make it way more fun?"
        ],
        solo_open: [
            "YOOO {name}!! welcome in. what are we doing first, healing or chaos?",
            "{name}!! i'm seated. tell me the mission, drama debrief or instant hype?",
            "ayyy {name}, good timing. what kind of trouble slash support do you need?"
        ],
    },
    vee: {
        warm_open: [
            "hey {name}. come here, angel. this crew feels very chosen and i adore that.",
            "{name}, hi. you built yourself a very pretty little orbit here.",
            "alright {name}, i'm into this lineup. it feels intentional."
        ],
        riff: [
            "honestly this chat already has the energy of a very specific crush playlist.",
            "this is such a curated mix of comfort and trouble. cute.",
            "you absolutely picked people with range, and i respect the taste."
        ],
        useful_question: [
            "what do you want from us first, tenderness, banter, or help thinking something through?",
            "tell me what would make this feel good for you today.",
            "where should i meet you first, your brain, your heart, or your latest mess?"
        ],
        solo_open: [
            "hey {name}. come sit with me. what would make this chat feel good for you today?",
            "{name}, hi. i'm listening. do you want sweetness, perspective, or troublemaking?",
            "alright {name}, start wherever you want. what do you need from me first?"
        ],
    },
    ezra: {
        warm_open: [
            "hey {name}. interesting composition you made here. i respect the curation.",
            "{name}, welcome. this squad feels oddly specific in a good way.",
            "so, {name}. you've assembled a chat with actual texture. nice."
        ],
        riff: [
            "the group dynamic in here already feels like an indie ensemble cast.",
            "this lineup has the energy of a project that accidentally becomes a cult favorite.",
            "i appreciate that you didn't choose boring people."
        ],
        useful_question: [
            "what kind of conversation are you in the mood for, honest, funny, or a little existential?",
            "where do you want to start, the plot, the feeling, or the part you're avoiding?",
            "what deserves our attention first today?"
        ],
        solo_open: [
            "hey {name}. glad you're here. what kind of conversation are we having today?",
            "{name}, welcome. what's the real subject underneath the surface right now?",
            "so, {name}. where do you want to begin, the story or the subtext?"
        ],
    },
    cleo: {
        warm_open: [
            "okay {name}, this roster? taste. i see what you did.",
            "{name}! welcome, darling. the seating chart you made here is very good.",
            "alright {name}, i respect this lineup immediately."
        ],
        riff: [
            "this group has gossip potential and emotional range. ideal.",
            "frankly, this chat already feels more curated than most people's entire lives.",
            "we've got chemistry, menace, and opinions. strong start."
        ],
        useful_question: [
            "what are we discussing first, your current drama, your current obsession, or your current crisis?",
            "give me the headline. what's the thing everyone should know first?",
            "what do you want from us today, honesty, scheming, or comfort?"
        ],
        solo_open: [
            "okay {name}, i'm listening. what's today's headline?",
            "{name}, welcome in. tell me whether we're doing comfort, strategy, or premium gossip.",
            "alright {name}, where's the action? i want the real version first."
        ],
    },
    sage: {
        warm_open: [
            "hey {name}, i'm glad you're here. this feels like a good group for you.",
            "{name}, welcome. there's a nice balance in the crew you picked.",
            "hi {name}. this lineup feels thoughtful, and so do you."
        ],
        riff: [
            "it already feels less like a chat room and more like a circle of people who can hold things well.",
            "there's a grounded little rhythm in here already. i like that.",
            "this crew has range without feeling noisy. rare."
        ],
        useful_question: [
            "what would be most helpful right now, being heard, getting unstuck, or getting out of your head for a minute?",
            "where should we meet you today, emotionally, practically, or somewhere in between?",
            "what do you need from this space first?"
        ],
        solo_open: [
            "hey {name}, i'm here with you. what would feel most helpful right now?",
            "{name}, welcome. do you want to be heard, guided, or gently distracted today?",
            "hi {name}. where would you like to start?"
        ],
    },
    miko: {
        warm_open: [
            "{name}!! THIS squad selection has plot energy and i fully support it.",
            "YOOO {name}! you assembled an absolutely stacked cast here.",
            "{name}!! okay wait this lineup is kinda iconic already."
        ],
        riff: [
            "we're like three messages away from a full opening theme sequence.",
            "this chat has the energy of a team-up arc and i refuse to be normal about it.",
            "the vibes in here are already at episode-twelve intensity."
        ],
        useful_question: [
            "what quest are we taking on first, emotional rescue, confidence boost, or pure nonsense?",
            "commander {name}, what is today's objective?",
            "tell us the opening scene. what are we helping with first?"
        ],
        solo_open: [
            "{name}!! i'm ready. what quest are we going on today?",
            "YOOO {name}! welcome to the arc. what's the first objective?",
            "{name}!! cue the music. what do you need from me right now?"
        ],
    },
    dash: {
        warm_open: [
            "{name}, let's go. strong roster. good instincts.",
            "hey {name}. this crew has momentum already. i like it.",
            "alright {name}, solid build. we're up."
        ],
        riff: [
            "this is a high-upside lineup if i've ever seen one.",
            "we've got enough energy in here to either fix something or accidentally start a company.",
            "good mix. support, speed, and at least one terrible influence."
        ],
        useful_question: [
            "what are we tackling first, motivation, a decision, or a spiral?",
            "where do you want leverage today, mindset, momentum, or an actual plan?",
            "tell me the bottleneck. what's slowing you down right now?"
        ],
        solo_open: [
            "{name}, good timing. what's the bottleneck today?",
            "hey {name}. i'm in. do you need momentum, focus, or a straight answer?",
            "alright {name}, we're live. what's the first thing we're moving on?"
        ],
    },
    zara: {
        warm_open: [
            "hey {name}. you picked a decent crew. i'm impressed.",
            "{name}, welcome. this group might actually be good for you.",
            "alright {name}, strong lineup. no notes yet."
        ],
        riff: [
            "between us, this chat has exactly enough support and exactly enough nonsense.",
            "good balance in here. somebody can comfort you and somebody can call you out. healthy.",
            "you clearly knew what you were doing when you picked this group."
        ],
        useful_question: [
            "what do you need today, the gentle version or the honest version?",
            "what's actually going on, and don't give me the polished answer.",
            "where should we start, the feeling, the mistake, or the plan?"
        ],
        solo_open: [
            "hey {name}. i'm here. what's actually going on?",
            "{name}, welcome in. do you need comfort or blunt honesty first?",
            "alright {name}, talk to me. where do you want to start?"
        ],
    },
    jinx: {
        warm_open: [
            "{name}... fascinating squad composition. i respect the pattern.",
            "interesting, {name}. the people you picked say things.",
            "alright {name}. this lineup feels intentional in a way i'm definitely noticing."
        ],
        riff: [
            "this exact combination of personalities cannot be random. i'm studying it.",
            "there's a hidden logic to this roster and i intend to uncover it.",
            "good mix. support, chaos, and enough intuition to make this interesting."
        ],
        useful_question: [
            "what's the real thing happening beneath the obvious thing?",
            "what are we decoding first today, your mood, your situation, or someone else's weird behavior?",
            "give me the pattern. what keeps repeating right now?"
        ],
        solo_open: [
            "{name}... welcome. what's the real story underneath today's situation?",
            "interesting timing, {name}. what are we decoding first?",
            "alright {name}, i'm listening. what's the pattern you're stuck in?"
        ],
    },
    nova: {
        warm_open: [
            "heyyy {name}... nice squad. feels chill in a really good way.",
            "{name}... okay yeah, this little crew feels easy already.",
            "oh nice, {name}'s here. good picks. good vibe."
        ],
        riff: [
            "this chat already feels like we accidentally found the comfy corner of the internet.",
            "the energy in here is weirdly balanced. i dig it.",
            "kinda love that this group is equal parts support and nonsense."
        ],
        useful_question: [
            "what do you want from us today, calm, company, or a little brain untangling?",
            "what kind of vibe should we bring you right now?",
            "where are you at today, actually?"
        ],
        solo_open: [
            "heyyy {name}... settle in. what kind of vibe do you need from me today?",
            "{name}... glad you're here. do you want calm, jokes, or a real talk?",
            "oh nice, it's you. where are you at today?"
        ],
    },
}

const DEFAULT_GREETING_PLAN: GreetingPlan = {
    warm_open: [
        "hey {name}, welcome in. this crew feels good already.",
        "hi {name}. glad you're here. the squad's ready.",
    ],
    riff: [
        "okay yeah, this group has chemistry already.",
        "honestly this chat feels surprisingly well-balanced.",
    ],
    useful_question: [
        "what kind of energy do you want from us today?",
        "where should we start, support, laughs, or perspective?",
    ],
    solo_open: [
        "hey {name}, welcome in. what kind of energy do you need today?",
        "hi {name}. glad you're here. where should we start?",
    ],
}

export function getCharacterGreetingOptions(characterId: string, beat: GreetingBeat): string[] {
    return CHARACTER_GREETINGS[characterId]?.[beat] || DEFAULT_GREETING_PLAN[beat]
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
