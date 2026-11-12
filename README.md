# Royal Ball 2026 Dot

Tickets and tables for The Lawyers’ Society Royal Ball Dinner (Fri 20 Nov 2026, Melian Event Center). A ticket-selling dot for one event, in your own Monime Space. People buy in Dash with mobile money, card or bank, the money lands in your Space, and each person gets a QR ticket that works at the door with no signal.

## Make it yours

1. Edit **`event.config.ts`**: name, date, venue, ticket types, prices (in cents) and colours.
2. Put your poster in `statics/` as a JPEG or PNG under 1 MB, and point `poster` at it.
3. In `dot.json`, set `name` to your event's name and `package` to a reverse domain you own, such as `sl.yourbrand.jazz-night-2026`.

Then run it in the simulator:

```bash
npm install
npm run dev        # http://localhost:3680
```

With `API_URL` empty in `.env`, a demo server inside the dot plays the ticket desk. Payments go through the simulator's stand-in sheet, and tickets say **Demo ticket · not valid**.

## Put it in your Space

```bash
monime login
monime space use <your-space>
monime dot keys create            # once per computer
monime dot register               # writes the dot's id into dot.json
monime dot publish --subtitle "Tickets for The Lawyers’ Society Royal Ball" --wait
```

Monime reviews every dot before it goes live, so **launch a few days before tickets go on sale**.

## The ticket server

Before you sell real tickets, set `API_URL` to a ticket server and add its host to `network.hosts` in `dot.json`. The server holds stock, sets the price, confirms each payment with Monime using your Space's API key, and signs each ticket's QR code. The dot never decides a ticket is paid, because anything inside a dot can be faked.

The endpoints it needs, including naming a pass and claiming a sent one, are listed at the top of `lib/server.ts`. It has to be deployed before real sales.

## What's inside

| Page | What it does |
| --- | --- |
| `index` | A slim banner, the date, venue and dress code side by side, "About the evening" in a bottom sheet, and **Get tickets** pinned to the bottom of the screen |
| `buy` | **Individual** tickets with a stepper and **Tables** chosen with one tap (one table per order, with the price a guest), then Continue |
| `checkout` | The order in guests, a **table card name** for tables, who's booking, a 10-minute hold, Dash's payment sheet, and pending mobile money |
| `tickets` | Every pass on this phone, with how many guests are named and sent |
| `ticket` | One QR **per guest** ("Guest 3 of 10"). The buyer adds each guest's name and taps **Send pass** to share their own link |
| `claim` | Opened from a sent pass link (`/claim?pass=…&key=…`): fetches that one pass onto the guest's phone |

Every guest gets their own pass: a VIP Double is 2 passes, a Chambers Table of 10 is 10. The first pass carries the buyer's name. Set `SHARE_URL` in `.env` once the dot is registered, or sent passes go out as text without a link.

```bash
npm test           # checkout, tables, naming and sending passes, claiming, the config
npm run typecheck
```
