import type { Game } from './deck.js';

// Rules text was reviewed and approved game by game; see RULES_REVIEW.md.
export const GAMES: Game[] = [
  {
    id: "note-noti",
    cat: "word",
    title: "Note Noti",
    players: "Any",
    setup: "None",
    spoiler: true,
    rules: {
      goal: "Work out the starter's secret rule.",
      steps: [
        "The starter says \"In the little town of Note Noti, there is...\" and adds a word. The secret rule is that the word has no E and no I.",
        "Everyone else takes turns saying the sentence with their own word.",
        "The starter says only \"right\" or \"wrong\". They never explain why."
      ],
      ends: "When everyone has worked out the rule.",
      example: "\"...there is a puppy\" is right. \"...there is a pie\" is wrong."
    }
  },
  {
    id: "picnic",
    cat: "word",
    title: "Picnic",
    players: "Any",
    setup: "None",
    spoiler: true,
    free: true,
    rules: {
      goal: "Work out the knower's secret rule.",
      steps: [
        "One player (the knower) secretly decides the rule: each item must start with the last letter of the previous item.",
        "They start: \"I'm bringing to the picnic a sandwich.\"",
        "Everyone else takes turns saying \"I'm bringing to the picnic...\" plus an item.",
        "The knower says only \"yes\" or \"no\"."
      ],
      ends: "When everyone has worked out the rule.",
      example: "Sandwich → Hummus → Soup."
    }
  },
  {
    id: "this-is-the-witch",
    cat: "word",
    title: "This Is the Witch",
    players: "3+",
    setup: "None",
    rules: {
      goal: "Pass the phrase down the line without slipping up.",
      steps: [
        "Player 1 says to Player 2, \"This is the witch.\" Player 2 asks \"The what?\", Player 1 says \"The witch,\" and Player 2 replies \"Ahh, the witch!\"",
        "Next round, Player 2 passes it to Player 3. Player 3 asks \"The what?\", Player 2 relays the question back to Player 1, and the answer travels forward again.",
        "Each round adds one more player, and the newest player starts the next round."
      ],
      ends: "Whenever you like. There's no real end."
    }
  },
  {
    id: "likes",
    cat: "word",
    title: "Likes",
    players: "Any",
    setup: "None",
    spoiler: true,
    free: true,
    rules: {
      goal: "Work out what the knower likes.",
      steps: [
        "One player (the knower) secretly decides the rule: they like things with a double letter in the name.",
        "They say, \"I like yellow, I don't like pink.\"",
        "Everyone else tries \"Do you like...?\" and the knower says only \"yes\" or \"no\"."
      ],
      ends: "When everyone has worked out the rule."
    }
  },
  {
    id: "the-moon-is-in-the-spoon",
    cat: "word",
    title: "The Moon Is in the Spoon",
    players: "Any",
    setup: "A spoon",
    spoiler: true,
    rules: {
      goal: "Work out the secret rule for passing the spoon.",
      steps: [
        "One player (the knower) picks a secret rule. A good one to start with is \"say thank you when you're handed the spoon\".",
        "Pass the spoon around, saying \"The moon is in the spoon\" as you hand it over.",
        "The knower stays in the game and says \"right\" or \"wrong\" after each pass."
      ],
      ends: "When everyone has worked out the rule."
    }
  },
  {
    id: "g-day-bruce",
    cat: "word",
    title: "G'day Bruce",
    players: "4+",
    setup: "None",
    rules: {
      goal: "Keep the greeting chain going without a mistake.",
      steps: [
        "Everyone is named Bruce.",
        "Player 1 says \"G'day Bruce\" to Player 2, who says it back. Player 1 then points at Player 3 and says \"Say g'day to Bruce Bruce.\"",
        "Player 2 starts the next round with Player 3, and the chain grows each round.",
        "If you mess up, you take a new name: Sheila, Wayne, Dwayne, or Shrimp on the Barbie."
      ],
      ends: "When people want to stop."
    }
  },
  {
    id: "ibble-dibble",
    cat: "word",
    title: "Ibble Dibble",
    players: "Any",
    setup: "None",
    rules: {
      goal: "Keep the calling going without a slip.",
      steps: [
        "Everyone gets a number.",
        "On your turn, say \"Ibble dibble number [yours], with no ibble dibbles, calls ibble dibble number [theirs], with no ibble dibbles, dibble ibble.\"",
        "You can't call back the person who just called you.",
        "Mess up and you gain an \"ibble dibble\" against your name."
      ],
      ends: "When people want to stop."
    }
  },
  {
    id: "categories",
    cat: "word",
    title: "Categories",
    players: "Any",
    setup: "None",
    free: true,
    rules: {
      goal: "Keep naming things without slipping.",
      steps: [
        "Someone picks a category, such as \"types of cheese\".",
        "Going around, everyone names something that fits.",
        "If anyone repeats, hesitates, or can't think of one, the round ends and the next category starts."
      ],
      ends: "When people want to stop."
    }
  },
  {
    id: "shopping-list",
    cat: "word",
    title: "Shopping List",
    players: "Any",
    setup: "None",
    rules: {
      goal: "Remember the whole list.",
      steps: [
        "The first player says \"I'm going to the shop and I'm buying [item].\"",
        "The next player repeats it and adds their own item.",
        "Keep going, repeating the whole growing list each turn."
      ],
      ends: "If you get it wrong you're out. The last player left wins."
    }
  },
  {
    id: "empire",
    cat: "word",
    title: "Empire",
    players: "6+",
    setup: "Slips of paper, a hat/bowl",
    setupShort: "Paper slips, hat",
    free: true,
    rules: {
      goal: "Build an empire that holds everyone.",
      steps: [
        "Everyone writes a name on a slip and puts it in the hat. The name can be a famous person or anyone they know. All the names are read out loud.",
        "On your turn, point at a player and ask \"Are they [name]?\" You're guessing which name that player wrote.",
        "If you're right, that player joins your empire. Their slips don't become yours, but they help you work out who the other people are. You also get another turn.",
        "If you're wrong, the player you asked gets to guess next."
      ],
      ends: "When one person's empire holds everyone. That person wins."
    }
  },
  {
    id: "wavelength",
    cat: "word",
    title: "Wavelength",
    players: "3+",
    setup: "None",
    rules: {
      goal: "Guess the secret number.",
      steps: [
        "Everyone except the guesser secretly agrees on a number from 1 to 10.",
        "The guesser gets 3 questions to ask the group.",
        "After the third question, the guesser names the number."
      ],
      ends: "The guesser wins if the number is right."
    }
  },
  {
    id: "toast",
    cat: "dinner",
    title: "Toast",
    players: "4+",
    setup: "None",
    rules: {
      goal: "Make the person on your left feel good.",
      steps: [
        "Pick someone to go first.",
        "Going around the table, each person gives a short toast or speech about the person on their left."
      ],
      ends: "When everyone has had a turn."
    }
  },
  {
    id: "psychiatrist",
    cat: "dinner",
    title: "Psychiatrist",
    players: "5+",
    setup: "None",
    spoiler: true,
    free: true,
    rules: {
      goal: "The guesser works out the secret scenario.",
      steps: [
        "One player (the guesser) leaves the room.",
        "The rest agree on a secret scenario, such as \"everyone answers as if they're the person on their left\".",
        "The guesser comes back and asks as many questions as they like. Everyone answers according to the scenario."
      ],
      ends: "When the guesser works out the scenario.",
      example: "Asked \"What's your favourite food?\", everyone answers as the person on their left would."
    }
  },
  {
    id: "dinner-derby",
    cat: "dinner",
    title: "Dinner Derby",
    players: "4+",
    setup: "Playing cards (one suit per person), William Tell Overture (music for atmosphere)",
    setupShort: "Cards, music",
    free: true,
    rules: {
      goal: "Be the first to make it all the way round the table back to your own seat.",
      steps: [
        "Each player gets a card suit.",
        "A host calls out suits. When your suit is called, you sit on the lap of the person to your left.",
        "The host plays the William Tell Overture, which gets louder as the game goes on."
      ],
      ends: "When someone gets back around to their own seat."
    }
  },
  {
    id: "oxford-vs-cambridge",
    cat: "dinner",
    title: "Oxford vs Cambridge",
    players: "6+ (even)",
    setup: "A fruit and a deck of cards",
    setupShort: "Fruit, cards",
    free: true,
    rules: {
      goal: "Be the first team back to your starting seats.",
      steps: [
        "Split into two equal teams, Oxford and Cambridge, sitting in two lines facing each other and holding hands along the line.",
        "A host deals the cards face-up one at a time. The two players nearest the cards (one from each team) and the two nearest the fruit (one from each team) keep their eyes open. Everyone else closes their eyes.",
        "When a royal (jack, queen or king) appears, the players nearest the cards squeeze the hand next to them. The squeeze passes down the line to the players at the fruit.",
        "The players nearest the fruit grab it as fast as they can. The team that grabs it shuffles down one seat, and the player at the end goes round to the front.",
        "If someone grabs the fruit when there was no royal, the other team shuffles down one seat instead."
      ],
      ends: "The first team back in its original seats wins."
    }
  },
  {
    id: "consequences",
    cat: "dinner",
    title: "Consequences",
    players: "4+",
    setup: "One sheet of paper per player",
    setupShort: "Paper",
    rules: {
      goal: "Write a silly story together without seeing what the others wrote.",
      steps: [
        "Everyone gets a sheet of paper.",
        "Write one line to match the prompt, then fold the paper to hide it and pass it to your left. The prompts go in this order: \"Him...\", \"Her...\", \"He said...\", \"She said...\", \"They...\", \"The whole world...\".",
        "Keep passing left each time until every sheet has six lines. With fewer than six players, the sheets just keep going round."
      ],
      ends: "Unfold the papers and read each story aloud."
    }
  },
  {
    id: "paranoia",
    cat: "dinner",
    title: "Paranoia",
    players: "5+",
    setup: "None",
    rules: {
      goal: "Find out who the question was about.",
      steps: [
        "Whisper a question starting with \"Who in this room...\" to the person on your left.",
        "They answer out loud by naming someone in the room.",
        "The person named can ask \"What was the question?\" To find out, they take a forfeit."
      ],
      ends: "When people want to stop."
    }
  },
  {
    id: "duck-duck-goose",
    cat: "active",
    title: "Duck Duck Goose",
    players: "6+",
    setup: "Chairs in a circle",
    rules: {
      goal: "Get round the circle and into the empty seat without being caught.",
      steps: [
        "Everyone sits in a circle. One player is \"it\" and walks around the outside.",
        "\"It\" taps each head, saying \"duck\", until they tap one and say \"goose\".",
        "The goose jumps up and chases \"it\" round the circle. \"It\" tries to reach the goose's empty seat first.",
        "If \"it\" is caught before reaching the seat, \"it\" goes again. Otherwise the goose is the new \"it\"."
      ],
      ends: "When people want to stop."
    }
  },
  {
    id: "sock-wrestling",
    cat: "active",
    title: "Sock Wrestling",
    players: "2",
    setup: "One sock per player",
    free: true,
    rules: {
      goal: "Pull off the other player's sock.",
      steps: [
        "Two players each wear one sock and face off on hands and knees.",
        "Try to pull the other player's sock off before they get yours."
      ],
      ends: "The first to pull the other's sock off wins."
    }
  },
  {
    id: "moo-off",
    cat: "active",
    title: "Moo Off",
    players: "2",
    setup: "None",
    rules: {
      goal: "Be the last to laugh.",
      steps: [
        "Two players get on hands and knees, face to face.",
        "Moo at each other."
      ],
      ends: "The first one to laugh loses."
    }
  },
  {
    id: "cereal-box-challenge",
    cat: "active",
    title: "Cereal Box Challenge",
    players: "2+",
    setup: "An empty cereal box, scissors",
    setupShort: "Cereal box, scissors",
    free: true,
    rules: {
      goal: "Be the last one who can still pick up the box.",
      steps: [
        "Stand an empty cereal box on the floor.",
        "Bend down and pick it up using only your teeth. No hands, and your knees can't touch the floor.",
        "After each round, cut a slice off the top of the box and go again.",
        "If you can't pick it up, you're out."
      ],
      ends: "The last player left wins."
    }
  },
  {
    id: "bottle-reach",
    cat: "active",
    title: "Bottle Reach",
    players: "2+",
    setup: "Two bottles, a line on the floor",
    setupShort: "Bottles, floor line",
    rules: {
      goal: "Place your bottle further forward than everyone else.",
      steps: [
        "Keep your feet behind the line.",
        "Hold a bottle in each hand and reach forward as far as you can.",
        "Put one bottle down, then pull back to standing while holding the second, without losing your balance."
      ],
      ends: "The player whose bottle is placed furthest forward wins."
    }
  },
  {
    id: "musical-chairs",
    cat: "active",
    title: "Musical Chairs",
    players: "4+",
    setup: "Chairs (one fewer than players), music",
    setupShort: "Chairs, music",
    rules: {
      goal: "Be the last one with a seat.",
      steps: [
        "Set out chairs in a circle, one fewer than the number of players.",
        "Walk around the chairs while the music plays.",
        "When the music stops, scramble for a seat. Whoever is left standing is out.",
        "Remove one chair each round."
      ],
      ends: "The last player left wins."
    }
  },
  {
    id: "newspaper-fight",
    cat: "active",
    title: "Newspaper Fight",
    players: "2",
    setup: "Blindfolds, a rolled-up newspaper, a bed or mat",
    setupShort: "Blindfolds, newspaper, mat",
    rules: {
      goal: "Hit the other player with the newspaper.",
      steps: [
        "Both players lie down blindfolded (on a bed, a mat, or the floor) with their left arms linked.",
        "Players go one at a time. Using only your right hand, try to hit the other player with the rolled-up newspaper."
      ],
      ends: "When you want to stop."
    }
  },
  {
    id: "feather",
    cat: "active",
    title: "Feather",
    players: "2+",
    setup: "A blanket, a feather",
    rules: {
      goal: "Keep the feather from landing on the floor on your side.",
      steps: [
        "Everyone holds the edges of a blanket taut with a feather resting on top.",
        "Blow the feather away from your side.",
        "It's fine if it lands on your side of the blanket. You only lose if it comes over your side and lands on the floor.",
        "The loser goes out and the rest keep playing."
      ],
      ends: "When one player is left. They win."
    }
  },
  {
    id: "charades",
    cat: "active",
    title: "Charades",
    players: "2+",
    setup: "None",
    free: true,
    rules: {
      goal: "Get everyone else to guess what you're acting out.",
      steps: [
        "Pick someone to go first.",
        "They act out a movie, book or phrase without speaking while everyone else guesses.",
        "Take turns."
      ],
      ends: "When people want to stop."
    }
  },
  {
    id: "hat-game",
    cat: "active",
    title: "Hat Game",
    players: "6+ (teams)",
    setup: "Slips of paper, a hat/bowl",
    setupShort: "Paper slips, hat",
    free: true,
    rules: {
      goal: "Get the most names guessed across all four rounds.",
      steps: [
        "Everyone writes names on slips and puts them in a hat. The same slips are used for every round.",
        "Split into teams. Teams take turns drawing a name and getting their teammates to guess it.",
        "Round 1: describe it in words. Round 2: act it out. Round 3: say one word only. Round 4: act it out under a blanket."
      ],
      ends: "After the fourth round. The team with the most names guessed across all rounds wins."
    }
  }
];
