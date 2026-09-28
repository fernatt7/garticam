# GartiCam

A Gartic Phone / Pictionary-style drawing-and-guessing game — except instead of drawing with a mouse, you draw **in the air**. A webcam tracks your fingertip in real time and turns its movement into strokes on a shared canvas, played live to the other player.

Built as a CS50x final project.

**Demo Video: https://garticam.vercel.app/**

**Live at [garticam.vercel.app](https://garticam.vercel.app/)**

## The Core Trick

There are two different views of the same session, composited from the same camera feed and canvas:

- **What the drawer sees locally:** their own camera feed, the current topic to draw, a floating toolbar (colors, brush size, eraser, undo), and their live drawing — all layered together.
- **What the other player sees:** just the camera feed and the drawing strokes. No toolbar, no topic text. To them, it looks like the drawer is sketching directly in midair over their own video.

## Features

- **Fingertip drawing** — real-time hand tracking, with the index fingertip mapped to canvas coordinates and smoothed to stay stable across frames.
- **Gesture controls, no mouse required:**
  - Pinch (thumb + index) to lift the pen without drawing.
  - A "phone call" gesture (thumb + pinky extended, other fingers curled) to toggle drawing on/off.
  - Hover over toolbar buttons and the color/width slider to select tools with just your fingertip.
  - Hover to pick one out of two topic options given
- **Live multiplayer** over WebRTC (via PeerJS) — video, audio, and drawing data all sync directly between two players with no game server
- **Turn-based gameplay** — alternating drawer/guesser roles, a round timer, guess checking with fuzzy matching (close misspellings still count), and running scores.
- **Solo mode** — practice the drawing mechanic without a second player.
- **Toolbar** — color palette, adjustable brush width, eraser, undo, and clear — all usable either by mouse or by hovering with your tracked fingertip.
- **Quality-of-life extras** — a fingertip glow/trail effect for visual feedback while drawing, a toggleable hand-landmark skeleton overlay incase you wanna see them, a canvas-only view toggle, and a mute button for the call audio.

## Tech Stack

- **Hand tracking:** [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) 
- **Networking:** [PeerJS](https://peerjs.com/) over WebRTC
- **Build tooling:** [Vite](https://vitejs.dev/)
- No backend game server — connection setup uses PeerJS, and everything else (gameplay state, drawing data, scoring) is exchanged directly between the two players' browsers.

## Running Locally

```bash
git clone https://github.com/fernatt7/garticam.git
cd garticam
npm install
npm run dev
```

Open the local dev URL in two browser windows (or two devices) to test a full round — one to create a room, one to join with the room ID shown.

## How to Play

1. Create a room (or join one with a room ID from a friend).
2. Once connected, the drawer picks a topic by hovering over one of two choices.
3. Draw with your index finger in the air — pinch to lift your pen, use the toolbar to change color/width, hover-dwell to pick tools without touching your keyboard or mouse.
4. The guesser types guesses in the chat; close matches are flagged, and an exact (or near-exact) match ends the round and awards points.
5. Turns alternate until the configured number of rounds is complete.

## Known Limitations

- **Two players only.** The networking layer is built specifically for 1:1 peer-to-peer play; it doesn't currently support rooms with three or more players.
- Best used on a reasonably lit room — hand tracking accuracy depends on the webcam's ability to clearly see the hand.

## Why I Made This

Coming up with an idea was the hardest part — I wanted to create something unique but most simple web apps already exist in some form. Rather than invent something new, I took something familiar (Gartic) and changed one core rule: what if you could draw mid-air instead?

And that became GartiCam: webcam → hand tracking → fingertip position → canvas coordinates → a stroke.

This was also a deliberate step up in difficulty for me. After finishing CS50x, I didn't feel confident enough to jump straight into something this ambitious, so I first built a handful of smaller practice projects (a to-do list, a contact search, a quiz, gartic ultra-lite and a few more) to get comfortable with JS fundamentals — JS idioms, objects/arrays, DOM manipulation, events, APIs before starting GartiCam for real.

## How This Was Built

I want to be upfront: I didn't build all of this alone. I designed and implemented the core of the project myself — the drawing system, the fingertip-to-canvas mapping, the basic game loop, and the overall structure. But partway through, a few pieces got disproportionately hard to build solo — what should've been small changes were eating hours before debugging even started — so I leaned heavily on AI for parts like toolbar hover, the phone-gesture, debugging the networking and game logic, and refining code I'd already written. CSS in particular is close to entirely AI-written since i really have no interest looking at properties and tweaking them.

I've built a website for pset before and used the CSS there as a reference for the AI to work on **[PHANSITE](https://github.com/code50/284684434/tree/main/Week8/homepage)**

This is also my first real project on GitHub, so the commit history isn't the cleanest — messages don't always match what actually changed since I often forgot to add new files, and I was still figuring out how often to commit and push as I went.

## Final Thoughts

I wanna start off with what I've learnt so far, this project definitely pushed my JS a lot further than where I started also became noticeably more fluent with browser APIs and working with variety of other APIs. It also gave me a much clearer picture of what actual development work looks like, and just how much more frustrating debugging gets once a project grows past certain scope...

GartiCam turned out better than I expected going in tho big chunk of it is thanks to AI helping along the way. But that did not change my involvement in the project and to be fair, it was really enganging to build something this cool ground up. I'm still proud of it.

## License

Planned under the MIT License.
