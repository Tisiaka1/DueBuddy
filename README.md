# Thebes

**A calmer way to keep up with Canvas assignments.** Thebes turns upcoming coursework into a focused todo list, so students can see what needs attention next without digging through every course.

## The problem

Canvas spreads assignments across courses and pages. When deadlines pile up, it can be hard to tell what is due soon, what to start next, and whether you are making progress.

## The solution

Thebes adds a compact assignment checklist to the Canvas dashboard. It gathers assignments from your favorite courses, puts the nearest due date first, and gives you a simple way to track your week.

- Highlights the next assignment due this week.
- Shows up to three more upcoming assignments.
- Tracks weekly progress and saves checkoffs in your browser.
- Uses your Canvas institution's brand color for a more native feel.

Checking off an item is a personal reminder in Thebes. It does not submit the assignment or change its status in Canvas.

## Install for development

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
3. Select **Load unpacked** and choose this project folder.
4. Open or refresh the IU Canvas dashboard at `https://iu.instructure.com/`.

The extension currently runs on the IU Canvas site configured in `manifest.json` and reads assignments from your favorite courses using your signed-in Canvas session.

## Project files

- `content.js` loads Canvas assignments, tracks local checkoffs, and renders the todo list.
- `styles.css` styles the widget and uses Canvas brand tokens where available.
- `manifest.json` configures the Chrome extension.
