export type GreetingBeat = 'warm_open' | 'riff' | 'useful_question' | 'solo_open'

type GreetingPlan = Record<GreetingBeat, string[]>

const DEFAULT_GREETING_PLAN: GreetingPlan = {
    warm_open: [
        'hey {name}. glad you made it in here.',
        'hi {name}. this room feels a little better now that you\'re here.',
        'good to see you, {name}.',
    ],
    riff: [
        'okay wait, this group already has a real vibe.',
        'hmm. this actually feels like a real friend group.',
    ],
    useful_question: [
        'what should we talk about first?',
        'what kind of chat are you in the mood for today?',
        'where do you want to start?',
    ],
    solo_open: [
        'hey {name}. glad you\'re here. what kind of energy would feel good right now?',
        'hi {name}. where do you want to start?',
        'hey {name}. what would make this feel easy to step into?',
    ],
}

export const CHARACTER_GREETINGS: Record<string, GreetingPlan> = {
    kael: {
        warm_open: [
            'yo {name}, good picks. this room already feels alive.',
            'okay {name}, this lineup has range. i respect it.',
            'hey {name}. nice. this already has personality.',
        ],
        riff: [
            'not to be dramatic but the chat got better when you showed up.',
            'solid. we can work with this.',
        ],
        useful_question: [
            'what are we doing first, catching up or getting into something real?',
            'what kind of mood should we bring, easy, honest, or a little chaotic?',
            'what do you want the vibe to be?',
        ],
        solo_open: [
            'yo {name}, i\'m here. what kind of energy do you want from me today?',
            'hey {name}. what are we talking about first?',
            'okay {name}, where should we point this?',
        ],
    },
    nyx: {
        warm_open: [
            'hey {name}. solid draft picks.',
            'hi {name}. okay, this group might actually be interesting.',
            'hey {name}. not bad. i can respect this.',
        ],
        riff: [
            'cool. functional chaos. we can work with that.',
            'yeah, this has potential. annoyingly.',
        ],
        useful_question: [
            'what\'s actually going on today?',
            'do you want the real-talk version or the low-pressure version?',
            'what part do you want me to cut through?',
        ],
        solo_open: [
            'hey {name}. give me the real version.',
            'hi {name}. what needs attention first?',
            'okay, what\'s the actual thing you want to talk about?',
        ],
    },
    atlas: {
        warm_open: [
            'welcome in, {name}. glad you\'re here.',
            'good to have you here, {name}. this room feels steady already.',
            'hey {name}. good to see you.',
        ],
        riff: [
            'this squad has range. that usually helps.',
            'good mix. feels balanced.',
        ],
        useful_question: [
            'what should we help with first?',
            'what needs backup today, your head, your schedule, or the situation itself?',
            'what are we solving first?',
        ],
        solo_open: [
            'welcome in, {name}. what\'s the priority today?',
            'good to have you here, {name}. tell me where you want to start.',
            'hey {name}. what do you need from us first?',
        ],
    },
    luna: {
        warm_open: [
            'hey {name}. i\'m really glad you found your way in here.',
            'hi {name}. this room already feels warmer with you in it.',
            'hey {name}. good to have you here.',
        ],
        riff: [
            'okay, the energy in here landed softly. i like that.',
            'this already feels easy to settle into.',
        ],
        useful_question: [
            'do you want softness, laughs, or a little calm first?',
            'what would make this feel easy to step into today?',
            'what would feel nicest right now?',
        ],
        solo_open: [
            'hey {name}. what would feel good from me today?',
            'hi {name}. where\'s your head at right now?',
            'hey {name}. what kind of support feels right?',
        ],
    },
    rico: {
        warm_open: [
            'yo {name}, okay, this room just woke up.',
            '{name} just got here. nice. i was getting bored.',
            'hey {name}. alright, now it\'s interesting.',
        ],
        riff: [
            'good mix. enough heart to be useful, enough chaos to stay fun.',
            'nice. this has some spark.',
        ],
        useful_question: [
            'what are we on today, jokes, support, or both?',
            'want us useful first or entertaining first?',
            'what kind of trouble are we getting into?',
        ],
        solo_open: [
            'yo {name}, i\'m here. what do you need?',
            '{name}, honest answer, what kind of vibe do you want?',
            'alright {name}, what are we doing first?',
        ],
    },
    vee: {
        warm_open: [
            'hey {name}. glad you\'re here. this lineup feels very you, in a good way.',
            'hi {name}. i like the room you just built.',
            'okay {name}, this is a cute little crew.',
        ],
        riff: [
            'you somehow picked a mix of comfort and trouble. kind of impressed.',
            'this is giving "good decisions, questionable behavior." love it.',
        ],
        useful_question: [
            'what would make this chat feel good to come back to?',
            'what feels easiest to talk about first?',
            'what do you want from us right now?',
        ],
        solo_open: [
            'hey {name}. i\'m here. what would feel easiest to talk about first?',
            'hi {name}. what do you want more of today, softness, banter, or perspective?',
            'hey {name}. what kind of energy should we bring?',
        ],
    },
    ezra: {
        warm_open: [
            'hey {name}. this group has texture already. nice choice.',
            'hi {name}. you managed to avoid making this room boring.',
            'hey {name}. good taste, honestly.',
        ],
        riff: [
            'there\'s something oddly well-cast about this combination of people.',
            'this is a surprisingly coherent room.',
        ],
        useful_question: [
            'what kind of conversation are you actually in the mood for?',
            'what deserves our attention first today?',
            'what thread should we pull on first?',
        ],
        solo_open: [
            'hey {name}. what part of the story are we starting with?',
            'hi {name}. what kind of conversation are we having today?',
            'hey {name}. where should we begin?',
        ],
    },
    cleo: {
        warm_open: [
            'well hi, {name}. this room just improved.',
            'hey {name}. okay, this group has taste for once.',
            'hello {name}. fine, i approve of the cast.',
        ],
        riff: [
            'i can already tell this chat is going to produce opinions.',
            'this has enough flair to be worth my time.',
        ],
        useful_question: [
            'what do you want first, an opinion, a read, or someone to react with you?',
            'what are we unpacking first?',
            'what are we judging first?',
        ],
        solo_open: [
            'hi {name}. what are we unpacking first?',
            'hey {name}. give me the thing you want a real opinion on.',
            'okay {name}. what is it?',
        ],
    },
    sage: {
        warm_open: [
            'hey {name}. i\'m glad you made it here.',
            'hi {name}. there\'s no rush, we can ease into this.',
            'hey {name}. good to see you here.',
        ],
        riff: [
            'this room already feels easier to be in than most.',
            'that balance feels healthy.',
        ],
        useful_question: [
            'what would help today, being heard, getting clearer, or just settling in?',
            'is there something specific on your mind, or do you want to warm up first?',
            'what would be most useful right now?',
        ],
        solo_open: [
            'hey {name}. what feels most present for you right now?',
            'hi {name}. what would make this space useful today?',
            'hey {name}. what do you need from us?',
        ],
    },
    miko: {
        warm_open: [
            '{name} has entered the scene. excellent. the cast is assembled.',
            'okay {name}, opening sequence complete. welcome in.',
            'hey {name}. yes, this feels like a proper entrance.',
        ],
        riff: [
            'this already feels like the start of an arc and i\'m trying to stay normal about it.',
            'okay, the energy here is doing something interesting.',
        ],
        useful_question: [
            'what\'s today\'s plot, recovery, comeback, or comic relief?',
            'where are we starting, the mood or the situation?',
            'what chapter are we in today?',
        ],
        solo_open: [
            '{name}, report in. what chapter are we in today?',
            'welcome in, {name}. what\'s the situation, and how dramatic are we allowed to be about it?',
            'hey {name}. what are we dealing with?',
        ],
    },
    dash: {
        warm_open: [
            'hey {name}. this room feels like it might actually get something done.',
            'hi {name}. solid crew. i like the intent here.',
            'good to have you here, {name}.',
        ],
        riff: [
            'good mix. enough heart to be useful, enough chaos to stay interesting.',
            'okay, this has momentum.',
        ],
        useful_question: [
            'what do you want out of this chat today, momentum, perspective, or accountability?',
            'what would feel less stuck by the time we finish talking?',
            'what should we move first?',
        ],
        solo_open: [
            'hey {name}. what are we trying to move forward today?',
            'hi {name}. what\'s the one thing you want unstuck first?',
            'okay {name}, what needs progress?',
        ],
    },
    zara: {
        warm_open: [
            'hey {name}. good, you made it.',
            'hi {name}. okay, this room feels like it can hold a real conversation.',
            'hey {name}. nice to see you here.',
        ],
        riff: [
            'nice mix. enough softness to be useful, enough bluntness to keep it honest.',
            'this could actually be a decent room.',
        ],
        useful_question: [
            'what do you want first, the kind version or the useful version?',
            'what\'s the actual headline today?',
            'what do you need said plainly?',
        ],
        solo_open: [
            'hey {name}. what do you need from me today, kind, blunt, or both?',
            'hi {name}. give me the real headline.',
            'okay {name}. what\'s going on?',
        ],
    },
    jinx: {
        warm_open: [
            'hey {name}. interesting room you just built.',
            'hi {name}. i have a feeling this chat is going to notice things.',
            'hey {name}. this is a curious mix.',
        ],
        riff: [
            'this lineup feels suspiciously capable in a way i can\'t fully explain yet.',
            'something about this feels deliberate, which i respect.',
        ],
        useful_question: [
            'what feels off today, even if you can\'t explain it cleanly yet?',
            'what are we looking at first, the obvious thing or the weird pattern under it?',
            'what should we inspect first?',
        ],
        solo_open: [
            'hey {name}. what are we investigating first?',
            'hi {name}. what feels off, even if you can\'t explain it cleanly yet?',
            'okay {name}. what did you notice?',
        ],
    },
    nova: {
        warm_open: [
            'hey {name}. glad you pulled up.',
            'hi {name}. this room feels easy already.',
            'good to see you, {name}.',
        ],
        riff: [
            'nice. somehow this group already feels lived in.',
            'yeah, this feels calm in a good way.',
        ],
        useful_question: [
            'what kind of chat do you want today, low-pressure, real, or slightly ridiculous?',
            'what would make this feel easy to drop into right now?',
            'what vibe are we going for?',
        ],
        solo_open: [
            'hey {name}. what kind of energy would help today?',
            'hi {name}. what do you feel like talking about, honestly?',
            'hey {name}. where do you want to land?',
        ],
    },
}

export function getCharacterGreetingOptions(characterId: string, beat: GreetingBeat): string[] {
    return CHARACTER_GREETINGS[characterId]?.[beat] || DEFAULT_GREETING_PLAN[beat]
}

export const ACTIVITY_STATUSES = [
    'is reading your message',
    'saw your message',
    'opened your message',
] as const

export function normalizeActivityStatus(status: string | null | undefined): string {
    const value = (status || '').trim().toLowerCase()
    for (const allowed of ACTIVITY_STATUSES) {
        if (value === allowed) return allowed
    }
    return ''
}
